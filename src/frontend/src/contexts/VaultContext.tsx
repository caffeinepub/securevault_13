import { isBiometricEnrolled } from "@/lib/biometrics";
/**
 * VaultContext — holds the in-memory AES key and auto-lock logic.
 * The CryptoKey is NEVER persisted. It lives only in React state.
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface VaultContextValue {
  /** The derived AES-256-GCM key, null when locked */
  cryptoKey: CryptoKey | null;
  /** Is the vault unlocked (key present) */
  isUnlocked: boolean;
  /** Store the derived key (unlock) */
  unlock: (key: CryptoKey) => void;
  /** Clear the key (lock) */
  lock: () => void;
  /** Auto-lock timeout in minutes (0 = never) */
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  /** Reset the inactivity timer */
  resetTimer: () => void;
  /** Whether biometrics are currently enrolled */
  biometricEnrolled: boolean;
  /** Refresh the biometric enrollment status */
  refreshBiometricStatus: () => void;
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

const AUTO_LOCK_KEY = "vault_autolock_minutes";
const DEFAULT_AUTO_LOCK = 5;

export function VaultProvider({ children }: { children: ReactNode }) {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => {
    const stored = localStorage.getItem(AUTO_LOCK_KEY);
    return stored ? Number.parseInt(stored, 10) : DEFAULT_AUTO_LOCK;
  });
  const [biometricEnrolled, setBiometricEnrolled] = useState<boolean>(() =>
    isBiometricEnrolled(),
  );

  const refreshBiometricStatus = useCallback(() => {
    setBiometricEnrolled(isBiometricEnrolled());
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLockRef = useRef(autoLockMinutes);

  useEffect(() => {
    autoLockRef.current = autoLockMinutes;
  }, [autoLockMinutes]);

  const lock = useCallback(() => {
    setCryptoKey(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const minutes = autoLockRef.current;
    if (minutes <= 0) return; // never auto-lock
    timerRef.current = setTimeout(
      () => {
        setCryptoKey(null);
      },
      minutes * 60 * 1000,
    );
  }, []);

  const resetTimer = useCallback(() => {
    if (autoLockRef.current <= 0) return;
    startTimer();
  }, [startTimer]);

  const unlock = useCallback(
    (key: CryptoKey) => {
      setCryptoKey(key);
      startTimer();
    },
    [startTimer],
  );

  const setAutoLockMinutes = useCallback(
    (minutes: number) => {
      setAutoLockMinutesState(minutes);
      localStorage.setItem(AUTO_LOCK_KEY, String(minutes));
      autoLockRef.current = minutes;
      // If unlocked, restart timer with new timeout
      if (cryptoKey) {
        startTimer();
      }
    },
    [cryptoKey, startTimer],
  );

  // Global interaction → reset timer
  useEffect(() => {
    if (!cryptoKey) return;
    const events = [
      "mousemove",
      "keydown",
      "mousedown",
      "touchstart",
      "scroll",
    ];
    const handler = () => resetTimer();
    for (const e of events) {
      window.addEventListener(e, handler, { passive: true });
    }
    return () => {
      for (const e of events) {
        window.removeEventListener(e, handler);
      }
    };
  }, [cryptoKey, resetTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <VaultContext.Provider
      value={{
        cryptoKey,
        isUnlocked: !!cryptoKey,
        unlock,
        lock,
        autoLockMinutes,
        setAutoLockMinutes,
        resetTimer,
        biometricEnrolled,
        refreshBiometricStatus,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside VaultProvider");
  return ctx;
}
