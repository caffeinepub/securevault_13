/**
 * WebAuthn-based biometric enrollment and verification.
 * The vault key is wrapped with a device-bound "wrapping key" stored in localStorage.
 * The wrapping key is only released by a successful biometric verification.
 *
 * Security model:
 * - A random 256-bit "device wrapping key" (AES-GCM) is stored in localStorage.
 * - The vault CryptoKey is exported, then encrypted with the device wrapping key.
 * - The encrypted vault key blob is stored in localStorage.
 * - On biometric unlock, the credential challenge is verified via WebAuthn, then
 *   the device wrapping key is used to decrypt and re-import the vault key.
 *
 * Note: WebAuthn does NOT cryptographically protect the wrapping key here —
 * it acts as a user-presence/liveness gate. This is the same model used by
 * most browser-based password managers with biometric unlock.
 */

const BIO_USER_ID_KEY = "vault_bio_user_id";
const BIO_CREDENTIAL_ID_KEY = "vault_bio_credential_id";
const BIO_DEVICE_KEY_KEY = "vault_device_key";
const BIO_WRAPPED_KEY_KEY = "vault_bio_wrapped_key";

// ── Helpers ────────────────────────────────────────────────────────────

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64ToBuffer(b64: string): ArrayBuffer {
  // Normalize base64url to base64
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "==".slice(0, (4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function generateUserId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ── Public API ─────────────────────────────────────────────────────────

export function isBiometricSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function isBiometricEnrolled(): boolean {
  return (
    !!localStorage.getItem(BIO_CREDENTIAL_ID_KEY) &&
    !!localStorage.getItem(BIO_DEVICE_KEY_KEY) &&
    !!localStorage.getItem(BIO_WRAPPED_KEY_KEY)
  );
}

/**
 * Enroll biometrics: creates a WebAuthn credential, wraps the vault key,
 * and stores the encrypted key blob in localStorage.
 */
export async function enrollBiometric(vaultKey: CryptoKey): Promise<void> {
  if (!isBiometricSupported()) {
    throw new Error("WebAuthn is not supported in this browser.");
  }

  // Get or create a stable user ID
  let userId = localStorage.getItem(BIO_USER_ID_KEY);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(BIO_USER_ID_KEY, userId);
  }

  const userIdBuffer = base64ToBuffer(userId);

  // Create WebAuthn credential
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "SecureVault",
        id: window.location.hostname,
      },
      user: {
        id: userIdBuffer,
        name: "vault-user",
        displayName: "Vault User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Biometric enrollment was cancelled.");

  const credentialId = base64url(credential.rawId);

  // Generate device wrapping key (AES-KW, 256-bit).
  // AES-KW is purpose-built for key wrapping and requires "wrapKey"/"unwrapKey" usages.
  const deviceKey = await crypto.subtle.generateKey(
    { name: "AES-KW", length: 256 },
    true, // extractable so we can export and store it in localStorage
    ["wrapKey", "unwrapKey"],
  );

  // Export the device key and store it
  const rawDeviceKey = await crypto.subtle.exportKey("raw", deviceKey);
  const deviceKeyB64 = btoa(
    String.fromCharCode(...new Uint8Array(rawDeviceKey)),
  );

  // Wrap the vault key using AES-KW.
  // wrapKey("raw") requires the key being wrapped to be extractable.
  // The vault key passed in here must have been derived with extractable: true
  // (see deriveKey in crypto.ts). AES-KW does not need an IV.
  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    "raw",
    vaultKey,
    deviceKey,
    { name: "AES-KW" },
  );

  const wrappedKeyB64 = btoa(
    String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)),
  );

  // Persist everything
  localStorage.setItem(BIO_CREDENTIAL_ID_KEY, credentialId);
  localStorage.setItem(BIO_DEVICE_KEY_KEY, deviceKeyB64);
  localStorage.setItem(BIO_WRAPPED_KEY_KEY, wrappedKeyB64);
}

/**
 * Verify biometrics and return the recovered vault CryptoKey.
 */
export async function verifyBiometric(): Promise<CryptoKey> {
  if (!isBiometricSupported()) {
    throw new Error("WebAuthn is not supported in this browser.");
  }

  const credentialIdB64 = localStorage.getItem(BIO_CREDENTIAL_ID_KEY);
  const deviceKeyB64 = localStorage.getItem(BIO_DEVICE_KEY_KEY);
  const wrappedKeyB64 = localStorage.getItem(BIO_WRAPPED_KEY_KEY);

  if (!credentialIdB64 || !deviceKeyB64 || !wrappedKeyB64) {
    throw new Error("Biometrics not enrolled. Please re-enroll.");
  }

  const credentialIdBuffer = base64ToBuffer(credentialIdB64);

  // Trigger WebAuthn assertion (biometric check)
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: credentialIdBuffer,
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error("Biometric verification was cancelled.");

  // Re-import device wrapping key as AES-KW
  const deviceKeyBytes = Uint8Array.from(atob(deviceKeyB64), (c) =>
    c.charCodeAt(0),
  );
  const deviceKey = await crypto.subtle.importKey(
    "raw",
    deviceKeyBytes,
    { name: "AES-KW" },
    false,
    ["unwrapKey"],
  );

  // Unwrap the vault key using AES-KW (no IV needed)
  const wrappedKeyBytes = Uint8Array.from(atob(wrappedKeyB64), (c) =>
    c.charCodeAt(0),
  );

  const vaultKey = await crypto.subtle.unwrapKey(
    "raw",
    wrappedKeyBytes,
    deviceKey,
    { name: "AES-KW" },
    { name: "AES-GCM", length: 256 },
    true, // extractable: true so future re-enrollment wrapping works
    ["encrypt", "decrypt"],
  );

  return vaultKey;
}

/**
 * Remove biometric enrollment from localStorage.
 */
export function removeBiometric(): void {
  localStorage.removeItem(BIO_CREDENTIAL_ID_KEY);
  localStorage.removeItem(BIO_DEVICE_KEY_KEY);
  localStorage.removeItem(BIO_WRAPPED_KEY_KEY);
  localStorage.removeItem(BIO_USER_ID_KEY);
}
