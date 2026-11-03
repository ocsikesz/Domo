// Roborock web API auth helpers: the client-id header and Hawk request signing
// for the RRIoT surface. Port of python-roborock (_base.py / _hawk.py).
import * as Crypto from 'expo-crypto';
import { hmac } from '@noble/hashes/hmac.js';
import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { base64Encode } from '../tuya/crypto';

export type RRiot = { u: string; s: string; h: string; k: string; r: { a: string } };

/** base64(md5(username + deviceIdentifier)) — identifies this app instance. */
export function headerClientId(username: string, deviceIdentifier: string): string {
  return base64Encode(md5(utf8ToBytes(username + deviceIdentifier)));
}

function md5Hex(s: string): string {
  return bytesToHex(md5(utf8ToBytes(s)));
}

function sortedMd5(values?: Record<string, string>): string {
  if (!values) return '';
  const joined = Object.keys(values)
    .sort()
    .map((k) => `${k}=${values[k]}`)
    .join('&');
  return md5Hex(joined);
}

/** Build the Hawk Authorization header for a RRIoT request. */
export function hawkAuth(
  rriot: RRiot,
  path: string,
  opts: { params?: Record<string, string>; body?: unknown } = {},
): string {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = Crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const paramsStr = sortedMd5(opts.params);
  const payloadStr = opts.body !== undefined ? md5Hex(JSON.stringify(opts.body)) : '';
  const prestr = [rriot.u, rriot.s, nonce, String(ts), md5Hex(path), paramsStr, payloadStr].join(':');
  const mac = base64Encode(hmac(sha256, utf8ToBytes(rriot.h), utf8ToBytes(prestr)));
  return `Hawk id="${rriot.u}",s="${rriot.s}",ts="${ts}",nonce="${nonce}",mac="${mac}"`;
}
