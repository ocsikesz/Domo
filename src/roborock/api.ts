// Roborock cloud client: official email + verification-code login, then home /
// device listing. Port of python-roborock's web_api (v1 flow). Command sending
// (start/stop cleaning) needs the MQTT binary protocol and is a later step.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { hawkAuth, headerClientId, RRiot } from './hawk';

const BASE_URLS = [
  'https://usiot.roborock.com',
  'https://euiot.roborock.com',
  'https://cniot.roborock.com',
  'https://ruiot.roborock.com',
];
const STORE_KEY = 'roborock_session';

export type RoborockSession = {
  username: string;
  deviceId: string;
  baseUrl: string;
  token: string;
  rriot: RRiot;
};

export type RoborockDevice = {
  duid: string;
  name: string;
  online: boolean;
  productName: string;
  battery?: number;
  state?: number;
};

export class RoborockError extends Error {}

async function postJson(url: string, params?: Record<string, string>, headers?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(url + qs, { method: 'POST', headers });
  return res.json();
}

/** Step 1: find the account's regional server and request an email code. */
export async function requestCode(username: string): Promise<{ baseUrl: string; deviceId: string }> {
  let found: string | null = null;
  for (const base of BASE_URLS) {
    try {
      const r = await postJson(`${base}/api/v1/getUrlByEmail`, { email: username, needtwostepauth: 'false' });
      if (r?.code === 200 && r.data?.url) {
        found = r.data.url;
        break;
      }
      if (r?.code === 2003) throw new RoborockError('Email invalid.');
    } catch (e) {
      if (e instanceof RoborockError) throw e;
    }
  }
  if (!found) throw new RoborockError('Contul nu a fost găsit pe serverele Roborock.');

  const deviceId = Crypto.randomUUID().replace(/-/g, '').slice(0, 22);
  const r = await postJson(
    `${found}/api/v1/sendEmailCode`,
    { username, type: 'auth' },
    { header_clientid: headerClientId(username, deviceId) },
  );
  if (r?.code === 9002) throw new RoborockError('Prea multe cereri de cod. Încearcă mai târziu.');
  if (r?.code === 2008) throw new RoborockError('Contul nu există.');
  if (r?.code !== 200) throw new RoborockError(r?.msg ?? 'Nu am putut trimite codul.');
  return { baseUrl: found, deviceId };
}

/** Step 2: exchange the email code for a session. */
export async function loginWithCode(
  username: string,
  code: string,
  baseUrl: string,
  deviceId: string,
): Promise<RoborockSession> {
  const r = await postJson(
    `${baseUrl}/api/v1/loginWithCode`,
    { username, verifycode: code, verifycodetype: 'AUTH_EMAIL_CODE' },
    { header_clientid: headerClientId(username, deviceId) },
  );
  if (r?.code === 2018) throw new RoborockError('Cod greșit.');
  if (r?.code !== 200) throw new RoborockError(r?.msg ?? 'Autentificare eșuată.');
  const d = r.data;
  const session: RoborockSession = {
    username,
    deviceId,
    baseUrl,
    token: d.token,
    rriot: { u: d.rriot.u, s: d.rriot.s, h: d.rriot.h, k: d.rriot.k, r: { a: d.rriot.r.a } },
  };
  await saveSession(session);
  return session;
}

export async function loadSession(): Promise<RoborockSession | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  return raw ? (JSON.parse(raw) as RoborockSession) : null;
}
export async function saveSession(s: RoborockSession): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
}
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}

export class RoborockClient {
  constructor(public session: RoborockSession) {}

  private async getHomeId(): Promise<number> {
    const res = await fetch(`${this.session.baseUrl}/api/v1/getHomeDetail`, {
      headers: {
        header_clientid: headerClientId(this.session.username, this.session.deviceId),
        Authorization: this.session.token,
      },
    });
    const r = await res.json();
    if (r?.code === 2010) throw new RoborockError('Sesiune invalidă. Reconectează-te.');
    if (r?.code !== 200) throw new RoborockError(r?.msg ?? 'Nu am putut citi locuința.');
    return r.data.rrHomeId;
  }

  async devices(): Promise<RoborockDevice[]> {
    const homeId = await this.getHomeId();
    const path = `/v2/user/homes/${homeId}`;
    const url = this.session.rriot.r.a + path;
    const res = await fetch(url, { headers: { Authorization: hawkAuth(this.session.rriot, path) } });
    const r = await res.json();
    if (!r?.success) throw new RoborockError(r?.msg ?? 'Nu am putut lista aparatele Roborock.');
    const products: Record<string, string> = {};
    for (const p of r.result.products ?? []) products[p.id] = p.name;
    return (r.result.devices ?? []).map((d: any) => ({
      duid: d.duid,
      name: d.name,
      online: !!d.online,
      productName: products[d.productId] ?? 'Roborock',
      battery: d.deviceStatus?.['120'] ?? d.deviceStatus?.battery,
      state: d.deviceStatus?.['121'] ?? d.deviceStatus?.state,
    }));
  }
}
