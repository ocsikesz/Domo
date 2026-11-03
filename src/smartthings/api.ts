// SmartThings client: OAuth (authorization-code + refresh) and device control.
// The user creates their own OAuth-In app (via the SmartThings CLI) and provides
// client_id / client_secret; nothing is hardcoded. Redirect URI is domo://oauth.
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { base64Encode } from '../tuya/crypto';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const AUTH_URL = 'https://api.smartthings.com/oauth/authorize';
const TOKEN_URL = 'https://api.smartthings.com/oauth/token';
const API = 'https://api.smartthings.com/v1';
const SCOPE = 'r:devices:* x:devices:* l:devices';
const REDIRECT = 'domo://oauth';
const STORE_KEY = 'smartthings_session';

export type StSession = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
};

export type StDevice = {
  id: string;
  label: string;
  online: boolean;
  isTv: boolean;
  capabilities: string[];
};

export class StError extends Error {}

function basicAuth(id: string, secret: string): string {
  return 'Basic ' + base64Encode(utf8ToBytes(`${id}:${secret}`));
}

/** Run the OAuth consent flow in the system browser and return a session. */
export async function connect(clientId: string, clientSecret: string): Promise<StSession> {
  const state = Crypto.randomUUID();
  const url =
    `${AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPE)}&state=${state}`;

  const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
  if (result.type !== 'success' || !result.url) throw new StError('Autentificare anulată.');
  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code as string | undefined;
  const returnedState = parsed.queryParams?.state as string | undefined;
  if (!code) throw new StError('Nu am primit codul de autorizare.');
  if (returnedState && returnedState !== state) throw new StError('State OAuth nepotrivit.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: REDIRECT,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(clientId, clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const r = await res.json();
  if (!res.ok || !r.access_token) throw new StError(r.error_description ?? r.error ?? 'Schimb de token eșuat.');
  const session: StSession = {
    clientId,
    clientSecret,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + (r.expires_in ?? 86400) * 1000,
  };
  await saveSession(session);
  return session;
}

export async function loadSession(): Promise<StSession | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  return raw ? (JSON.parse(raw) as StSession) : null;
}
export async function saveSession(s: StSession): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
}
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}

export class StClient {
  private refreshing: Promise<void> | null = null;

  constructor(public session: StSession) {}

  private async refreshIfNeeded(): Promise<void> {
    if (this.session.expiresAt - 60_000 > Date.now()) return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.session.clientId,
          refresh_token: this.session.refreshToken,
        });
        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: {
            Authorization: basicAuth(this.session.clientId, this.session.clientSecret),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });
        const r = await res.json();
        if (!res.ok || !r.access_token) throw new StError('Sesiune expirată. Reconectează-te la SmartThings.');
        this.session = {
          ...this.session,
          accessToken: r.access_token,
          refreshToken: r.refresh_token ?? this.session.refreshToken, // rotates
          expiresAt: Date.now() + (r.expires_in ?? 86400) * 1000,
        };
        await saveSession(this.session);
      })().finally(() => {
        this.refreshing = null;
      });
    }
    await this.refreshing;
  }

  private async api(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    await this.refreshIfNeeded();
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.session.accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) throw new StError('Token respins. Reconectează-te la SmartThings.');
    if (!res.ok) throw new StError(`SmartThings HTTP ${res.status}`);
    return res.status === 200 ? res.json() : {};
  }

  async devices(): Promise<StDevice[]> {
    const r = await this.api('GET', '/devices');
    return (r.items ?? []).map((d: any) => {
      const caps: string[] = [];
      for (const c of d.components ?? []) for (const cap of c.capabilities ?? []) caps.push(cap.id);
      return {
        id: d.deviceId,
        label: d.label ?? d.name ?? 'Dispozitiv',
        online: true,
        isTv: caps.includes('tvChannel') || /tv|television/i.test(d.name ?? ''),
        capabilities: caps,
      };
    });
  }

  private command(capability: string, command: string, args?: unknown[]) {
    return { component: 'main', capability, command, ...(args ? { arguments: args } : {}) };
  }

  async setPower(deviceId: string, on: boolean): Promise<void> {
    await this.api('POST', `/devices/${deviceId}/commands`, {
      commands: [this.command('switch', on ? 'on' : 'off')],
    });
  }
  async volume(deviceId: string, up: boolean): Promise<void> {
    await this.api('POST', `/devices/${deviceId}/commands`, {
      commands: [this.command('audioVolume', up ? 'volumeUp' : 'volumeDown')],
    });
  }
  async mute(deviceId: string): Promise<void> {
    await this.api('POST', `/devices/${deviceId}/commands`, { commands: [this.command('audioMute', 'mute')] });
  }
}
