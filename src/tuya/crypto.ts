// Request signing and payload encryption for the Tuya "device sharing" API.
// Port of tuya-device-sharing-sdk (customerapi.py). Pure functions so they can
// be checked against the Python implementation.
import { gcm } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function base64Decode(str: string): Uint8Array {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return new Uint8Array(out);
}

const NONCE_CHARS = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';

export function randomNonce(length: number, random: () => number = Math.random): string {
  let n = '';
  for (let i = 0; i < length; i++) n += NONCE_CHARS[Math.floor(random() * NONCE_CHARS.length)];
  return n;
}

export function md5Hex(text: string): string {
  return bytesToHex(md5(utf8ToBytes(text)));
}

/** 16-char AES key derived from the request id and hash key (sid is always empty here). */
export function secretFor(rid: string, hashKey: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(rid), utf8ToBytes(hashKey))).slice(0, 16);
}

export function encrypt(raw: string, secret: string, nonce: string = randomNonce(12)): string {
  const nonceBytes = utf8ToBytes(nonce);
  const sealed = gcm(utf8ToBytes(secret), nonceBytes).encrypt(utf8ToBytes(raw));
  return base64Encode(nonceBytes) + base64Encode(sealed);
}

export function decrypt(data: string, secret: string): string {
  const bytes = base64Decode(data);
  const opened = gcm(utf8ToBytes(secret), bytes.slice(0, 12)).decrypt(bytes.slice(12));
  return utf8Decode(opened);
}

/** UTF-8 bytes to string, without relying on TextDecoder (not guaranteed on Hermes). */
export function utf8Decode(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    else if (c < 0xf0) cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    else cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

const SIGNED_HEADERS = ['X-appKey', 'X-requestId', 'X-sid', 'X-time', 'X-token'];

export function sign(
  hashKey: string,
  queryEnc: string,
  bodyEnc: string,
  headers: Record<string, string>,
): string {
  const parts = SIGNED_HEADERS.filter((h) => headers[h]).map((h) => `${h}=${headers[h]}`);
  const str = parts.join('||') + queryEnc + bodyEnc;
  return bytesToHex(hmac(sha256, utf8ToBytes(hashKey), utf8ToBytes(str)));
}
