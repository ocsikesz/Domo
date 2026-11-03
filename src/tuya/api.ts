// Tuya "device sharing" client: Smart Life QR login, signed+encrypted requests,
// token refresh, homes, devices, commands. Port of tuya-device-sharing-sdk.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { decrypt, encrypt, md5Hex, secretFor, sign } from './crypto';

// Public client id / schema registered by the Home Assistant Tuya integration.
export const CLIENT_ID = 'HA_3y9q4ak7g4ephrvke';
const SCHEMA = 'haauthorize';
const LOGIN_HOST = 'https://apigw.iotbing.com';
const STORE_KEY = 'tuya_session';

export type TuyaSession = {
  userCode: string;
  endpoint: string;
  terminalId: string;
  uid: string;
  accessToken: string;
  refreshToken: string;
  expireTime: number; // ms epoch
};

export type TuyaHome = { id: string; name: string };

export type TuyaDevice = {
  id: string;
  name: string;
  category: string;
  product_name: string;
  online: boolean;
  icon?: string;
  status: Record<string, unknown>;
};

export class TuyaError extends Error {
  constructor(public code: string | number, message: string) {
    super(message);
  }
}

// ---------- QR login ----------

/** Returns the string to encode in the QR code and the token to poll with. */
export async function startQrLogin(userCode: string): Promise<{ qr: string; token: string }> {
  const url = `${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens?clientid=${CLIENT_ID}&usercode=${encodeURIComponent(userCode)}&schema=${SCHEMA}`;
  const res = await (await fetch(url, { method: 'POST' })).json();
  if (!res.success) throw new TuyaError(res.code, res.msg ?? 'Cod de utilizator invalid');
  const token = res.result.qrcode as string;
  return { qr: `tuyaSmart--qrLogin?token=${token}`, token };
}

/** Polls once; resolves to a session when the user has confirmed in Smart Life, else null. */
export async function pollQrLogin(userCode: string, token: string): Promise<TuyaSession | null> {
  const url = `${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens/${token}?clientid=${CLIENT_ID}&usercode=${encodeURIComponent(userCode)}`;
  const res = await (await fetch(url)).json();
  if (!res.success) return null;
  const r = res.result;
  return {
    userCode,
    endpoint: r.endpoint,
    terminalId: r.terminal_id,
    uid: r.uid,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expireTime: (res.t ?? Date.now()) + (r.expire_time ?? 0) * 1000,
  };
}

// ---------- session storage ----------

export async function loadSession(): Promise<TuyaSession | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  return raw ? (JSON.parse(raw) as TuyaSession) : null;
}

export async function saveSession(s: TuyaSession): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}

// ---------- signed client ----------

export class TuyaClient {
  private refreshing: Promise<void> | null = null;

  constructor(public session: TuyaSession) {}

  private async request(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    skipRefresh = false,
  ): Promise<any> {
    if (!skipRefresh) await this.refreshIfNeeded();

    const rid = Crypto.randomUUID();
    const hashKey = md5Hex(rid + this.session.refreshToken);
    const secret = secretFor(rid, hashKey);

    const queryEnc = params && Object.keys(params).length ? encrypt(JSON.stringify(params), secret) : '';
    const bodyEnc = body && Object.keys(body).length ? encrypt(JSON.stringify(body), secret) : '';

    const headers: Record<string, string> = {
      'X-appKey': CLIENT_ID,
      'X-requestId': rid,
      'X-sid': '',
      'X-time': String(Date.now()),
    };
    if (this.session.accessToken) headers['X-token'] = this.session.accessToken;
    headers['X-sign'] = sign(hashKey, queryEnc, bodyEnc, headers);

    let url = this.session.endpoint + path;
    if (queryEnc) url += `?encdata=${encodeURIComponent(queryEnc)}`;

    const res = await fetch(url, {
      method,
      headers: { ...headers, ...(bodyEnc ? { 'Content-Type': 'application/json' } : {}) },
      body: bodyEnc ? JSON.stringify({ encdata: bodyEnc }) : undefined,
    });
    if (!res.ok) throw new TuyaError(res.status, `HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success) throw new TuyaError(json.code, json.msg ?? 'Eroare Tuya');
    if (typeof json.result === 'string' && json.result) {
      const plain = decrypt(json.result, secret);
      try {
        json.result = JSON.parse(plain);
      } catch {
        json.result = plain;
      }
    }
    return json;
  }

  private async refreshIfNeeded(): Promise<void> {
    if (this.session.expireTime - 60_000 > Date.now()) return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const res = await this.request('GET', `/v1.0/m/token/${this.session.refreshToken}`, undefined, undefined, true);
        const r = res.result;
        this.session = {
          ...this.session,
          uid: r.uid,
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
          expireTime: res.t + r.expireTime * 1000,
        };
        await saveSession(this.session);
      })().finally(() => {
        this.refreshing = null;
      });
    }
    await this.refreshing;
  }

  async homes(): Promise<TuyaHome[]> {
    const res = await this.request('GET', '/v1.0/m/life/users/homes');
    return (res.result ?? []).map((h: any) => ({ id: String(h.ownerId), name: h.name }));
  }

  async devices(homeId: string): Promise<TuyaDevice[]> {
    const res = await this.request('GET', '/v1.0/m/life/ha/home/devices', { homeId });
    return (res.result ?? []).map((d: any) => {
      const status: Record<string, unknown> = {};
      for (const s of d.status ?? []) if (s && 'code' in s) status[s.code] = s.value;
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        product_name: d.product_name,
        online: !!d.online,
        icon: d.icon,
        status,
      };
    });
  }

  async sendCommands(deviceId: string, commands: { code: string; value: unknown }[]): Promise<void> {
    await this.request('POST', `/v1.1/m/thing/${deviceId}/commands`, undefined, { commands });
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', '/v1.0/m/token/terminal/expire', undefined, {
        accessToken: this.session.accessToken,
        terminalId: this.session.terminalId,
      });
    } finally {
      await clearSession();
    }
  }
}
