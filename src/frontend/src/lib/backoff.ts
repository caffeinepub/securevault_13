/**
 * Exponential backoff for wrong master password attempts.
 * Tracks failed attempts and lockout expiry in localStorage.
 */

const FAILED_ATTEMPTS_KEY = "vault_failed_attempts";
const LOCKOUT_UNTIL_KEY = "vault_lockout_until";

/** Delay in milliseconds per attempt count (1-indexed, 6+ = 300s) */
const BACKOFF_DELAYS_MS: Record<number, number> = {
  1: 0,
  2: 5_000,
  3: 15_000,
  4: 45_000,
  5: 120_000,
  6: 300_000,
};

function getDelayMs(attempts: number): number {
  if (attempts <= 1) return BACKOFF_DELAYS_MS[1];
  if (attempts <= 6) return BACKOFF_DELAYS_MS[attempts] ?? BACKOFF_DELAYS_MS[6];
  return BACKOFF_DELAYS_MS[6];
}

export interface BackoffState {
  attempts: number;
  lockedUntil: number; // Unix timestamp in ms, 0 = not locked
}

export function getBackoffState(): BackoffState {
  const attempts = Number.parseInt(
    localStorage.getItem(FAILED_ATTEMPTS_KEY) ?? "0",
    10,
  );
  const lockedUntil = Number.parseInt(
    localStorage.getItem(LOCKOUT_UNTIL_KEY) ?? "0",
    10,
  );
  return { attempts, lockedUntil };
}

/**
 * Record a failed attempt. Returns the number of milliseconds the user must wait.
 */
export function recordFailedAttempt(): number {
  const { attempts } = getBackoffState();
  const newAttempts = attempts + 1;
  const delayMs = getDelayMs(newAttempts);
  const lockedUntil = delayMs > 0 ? Date.now() + delayMs : 0;

  localStorage.setItem(FAILED_ATTEMPTS_KEY, String(newAttempts));
  localStorage.setItem(LOCKOUT_UNTIL_KEY, String(lockedUntil));

  return delayMs;
}

/**
 * Reset backoff state (call on successful unlock).
 */
export function resetBackoff(): void {
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
}

/**
 * Returns remaining lockout time in ms, 0 if not locked.
 */
export function getLockoutRemainingMs(): number {
  const { lockedUntil } = getBackoffState();
  if (!lockedUntil) return 0;
  const remaining = lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}
