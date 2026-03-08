/**
 * Vault Crypto Utilities
 * AES-256-GCM client-side encryption using Web Crypto API.
 * The master password and derived key are NEVER stored persistently.
 */

const SALT_KEY = "vault_salt";
const VERIFIER_KEY = "vault_verifier";
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";

// A fixed known plaintext we encrypt on setup so we can verify the password on unlock.
const VERIFIER_PLAINTEXT = "vault-password-verifier-v1";

// ── Typed Uint8Array helper ────────────────────────────────────────────

function makeBytes(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length));
}

function fillRandom(arr: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  crypto.getRandomValues(arr);
  return arr;
}

// ── Salt management ────────────────────────────────────────────────────

export function getSalt(): Uint8Array<ArrayBuffer> | null {
  const stored = localStorage.getItem(SALT_KEY);
  if (!stored) return null;
  return base64ToBytes(stored);
}

export function createAndStoreSalt(): Uint8Array<ArrayBuffer> {
  const salt = fillRandom(makeBytes(16));
  localStorage.setItem(SALT_KEY, bytesToBase64(salt));
  return salt;
}

export function hasSalt(): boolean {
  return !!localStorage.getItem(SALT_KEY);
}

// ── Password verifier ──────────────────────────────────────────────────

/**
 * Encrypt a known plaintext with the derived key and store it.
 * Called once during vault setup so we can verify the password on future unlocks.
 */
export async function storePasswordVerifier(key: CryptoKey): Promise<void> {
  const enc = new TextEncoder();
  const iv = fillRandom(makeBytes(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(VERIFIER_PLAINTEXT),
  );
  const combined = makeBytes(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  localStorage.setItem(VERIFIER_KEY, bytesToBase64(combined));
}

/**
 * Returns true if the given key can decrypt the stored verifier blob.
 * Returns false on wrong password (decrypt fails). Throws on unexpected errors.
 */
export async function verifyPasswordKey(key: CryptoKey): Promise<boolean> {
  const stored = localStorage.getItem(VERIFIER_KEY);
  if (!stored) {
    // No verifier stored yet (pre-existing vault) — accept and store one now.
    return true;
  }
  try {
    const combined = base64ToBytes(stored);
    const iv = combined.slice(0, 12) as Uint8Array<ArrayBuffer>;
    const ciphertext = combined.slice(12) as Uint8Array<ArrayBuffer>;
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return true;
  } catch {
    return false;
  }
}

// ── Key derivation ─────────────────────────────────────────────────────

export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable: true so biometric enrollment can wrap this key
    ["encrypt", "decrypt"],
  );
}

// ── Encrypt / Decrypt ──────────────────────────────────────────────────

/**
 * Encrypts a plain object with AES-256-GCM.
 * Returns base64(iv[12 bytes] + ciphertext).
 */
export async function encryptPayload(
  key: CryptoKey,
  data: Record<string, unknown>,
): Promise<string> {
  const iv = fillRandom(makeBytes(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // Concatenate iv + ciphertext
  const combined = makeBytes(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return bytesToBase64(combined);
}

/**
 * Decrypts a base64(iv + ciphertext) string.
 * Returns the original plain object.
 */
export async function decryptPayload(
  key: CryptoKey,
  encoded: string,
): Promise<Record<string, unknown>> {
  const combined = base64ToBytes(encoded);
  const iv = combined.slice(0, 12) as Uint8Array<ArrayBuffer>;
  const ciphertext = combined.slice(12) as Uint8Array<ArrayBuffer>;

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext)) as Record<string, unknown>;
}

// ── Re-encrypt all entries with a new key ──────────────────────────────

export async function reEncryptPayload(
  oldKey: CryptoKey,
  newKey: CryptoKey,
  encoded: string,
): Promise<string> {
  const data = await decryptPayload(oldKey, encoded);
  return encryptPayload(newKey, data);
}

// ── Base64 helpers ──────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = makeBytes(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Password generator ─────────────────────────────────────────────────

const CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

export function generatePassword(length = 16): string {
  const bytes = fillRandom(makeBytes(length));
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}
