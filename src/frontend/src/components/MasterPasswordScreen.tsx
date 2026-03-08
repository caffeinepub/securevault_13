import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/contexts/VaultContext";
import {
  getBackoffState,
  getLockoutRemainingMs,
  recordFailedAttempt,
  resetBackoff,
} from "@/lib/backoff";
import {
  enrollBiometric,
  isBiometricEnrolled,
  isBiometricSupported,
  verifyBiometric,
} from "@/lib/biometrics";
import {
  createAndStoreSalt,
  deriveKey,
  getSalt,
  hasSalt,
  storePasswordVerifier,
  verifyPasswordKey,
} from "@/lib/crypto";
import {
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

interface Props {
  mode: "setup" | "unlock";
}

export function MasterPasswordScreen({ mode }: Props) {
  const { unlock, refreshBiometricStatus } = useVault();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backoff state — track attempts as component state so the effect re-runs properly
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() =>
    getLockoutRemainingMs(),
  );
  const [failedAttempts, setFailedAttempts] = useState<number>(
    () => getBackoffState().attempts,
  );

  // Biometric state
  const [bioEnrolled] = useState(() => isBiometricEnrolled());
  const [bioSupported] = useState(() => isBiometricSupported());
  const [showPasswordForm, setShowPasswordForm] = useState(
    !isBiometricEnrolled() || !isBiometricSupported(),
  );
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Post-unlock biometric enrollment prompt
  const [showBioPrompt, setShowBioPrompt] = useState(false);
  const [enrollingBio, setEnrollingBio] = useState(false);
  // Store the unlocked key so we can enroll biometrics with it
  const [unlockedKey, setUnlockedKey] = useState<CryptoKey | null>(null);

  // Countdown timer for lockout — re-runs when failedAttempts changes to restart countdown
  // biome-ignore lint/correctness/useExhaustiveDependencies: failedAttempts is intentional trigger dependency
  useEffect(() => {
    const remaining = getLockoutRemainingMs();
    if (remaining <= 0) {
      setLockoutRemaining(0);
      return;
    }
    setLockoutRemaining(remaining);
    const interval = setInterval(() => {
      const r = getLockoutRemainingMs();
      setLockoutRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [failedAttempts]);

  const isLocked = lockoutRemaining > 0;
  const lockoutSeconds = Math.ceil(lockoutRemaining / 1000);

  async function handleBiometricUnlock() {
    setBioError(null);
    setIsBioLoading(true);
    try {
      const key = await verifyBiometric();
      unlock(key);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Biometric verification failed.";
      setBioError(msg);
      setShowPasswordForm(true);
    } finally {
      setIsBioLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isLocked) return;

    if (!password.trim()) {
      setError("Please enter your master password.");
      return;
    }

    if (mode === "setup") {
      if (password.length < 8) {
        setError("Master password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsLoading(true);
    try {
      let salt: Uint8Array<ArrayBuffer>;
      if (mode === "setup") {
        salt = createAndStoreSalt();
      } else {
        const existing = getSalt();
        if (!existing)
          throw new Error("Salt not found. Please reset the vault.");
        salt = existing;
      }

      const key = await deriveKey(password, salt);

      if (mode === "unlock") {
        // Verify the derived key against the stored verifier blob.
        const isCorrect = await verifyPasswordKey(key);
        if (!isCorrect) {
          const waitMs = recordFailedAttempt();
          const newState = getBackoffState();
          setFailedAttempts(newState.attempts);
          if (waitMs > 0) {
            const secs = Math.ceil(waitMs / 1000);
            setError(
              `Wrong password. Too many attempts — try again in ${secs}s. (Attempt ${newState.attempts})`,
            );
            setLockoutRemaining(waitMs);
          } else {
            setError("Wrong password. Please try again.");
          }
          return;
        }
        resetBackoff();
        // Show biometric enrollment prompt if not enrolled
        if (!isBiometricEnrolled() && isBiometricSupported()) {
          setUnlockedKey(key);
          setShowBioPrompt(true);
          unlock(key);
        } else {
          unlock(key);
        }
      } else {
        // Setup: store the verifier so future unlocks can verify the password.
        await storePasswordVerifier(key);
        resetBackoff();
        unlock(key);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to unlock vault. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleEnrollBiometrics = useCallback(async () => {
    if (!unlockedKey) return;
    setEnrollingBio(true);
    try {
      await enrollBiometric(unlockedKey);
      refreshBiometricStatus();
      setShowBioPrompt(false);
    } catch {
      setShowBioPrompt(false);
    } finally {
      setEnrollingBio(false);
    }
  }, [unlockedKey, refreshBiometricStatus]);

  const isSetup = mode === "setup";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[100px]" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.18 195) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm mx-auto px-4 sm:px-6"
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center vault-glow">
            {isSetup ? (
              <KeyRound className="h-7 w-7 text-primary" />
            ) : (
              <Lock className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {isSetup ? "Create Master Password" : "Vault Locked"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSetup
                ? "This password encrypts all your vault data. It cannot be recovered."
                : "Enter your master password to unlock."}
            </p>
          </div>
        </div>

        {/* Biometric unlock section (unlock mode only) */}
        {!isSetup && bioEnrolled && bioSupported && (
          <div className="mb-5 space-y-3">
            {bioError && (
              <div
                data-ocid="vault.error_state"
                className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-2xl px-3 py-2"
              >
                {bioError}
              </div>
            )}
            <Button
              data-ocid="master_password.biometric_button"
              type="button"
              onClick={() => void handleBiometricUnlock()}
              disabled={isBioLoading || isLocked}
              className="w-full h-12 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 vault-glow"
            >
              {isBioLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Unlock with Biometrics
                </>
              )}
            </Button>
          </div>
        )}

        {/* Biometric enrollment prompt (shown after password unlock when not enrolled) */}
        <AnimatePresence>
          {showBioPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground font-medium">
                      Want to use Face ID / Touch ID next time?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBioPrompt(false)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-ocid="master_password.enable_biometrics_button"
                    size="sm"
                    onClick={() => void handleEnrollBiometrics()}
                    disabled={enrollingBio}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
                  >
                    {enrollingBio ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Fingerprint className="mr-1.5 h-3 w-3" />
                    )}
                    Enable Biometrics
                  </Button>
                  <Button
                    data-ocid="master_password.bio_prompt_dismiss_button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBioPrompt(false)}
                    className="text-muted-foreground text-xs h-8"
                  >
                    Not now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password form */}
        <AnimatePresence>
          {(isSetup || showPasswordForm) && (
            <motion.div
              initial={!isSetup ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="master-password"
                    className="text-sm font-medium"
                  >
                    {isSetup ? "Master Password" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="master-password"
                      data-ocid="master_password.input"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        isSetup
                          ? "Create a strong password"
                          : "Enter your password"
                      }
                      autoComplete={
                        isSetup ? "new-password" : "current-password"
                      }
                      autoFocus={!bioEnrolled || !bioSupported}
                      className="pr-10 bg-secondary/50 border-border focus:border-primary/50 font-mono tracking-wide text-base"
                      disabled={isLoading || isLocked}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isSetup && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="master-password-confirm"
                      className="text-sm font-medium"
                    >
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="master-password-confirm"
                        data-ocid="master_password.confirm_input"
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        className="pr-10 bg-secondary/50 border-border focus:border-primary/50 font-mono tracking-wide text-base"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={
                          showConfirm ? "Hide password" : "Show password"
                        }
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lockout countdown error */}
                {isLocked && (
                  <div
                    data-ocid="vault.error_state"
                    className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-2xl px-3 py-2"
                  >
                    Too many attempts. Try again in {lockoutSeconds}s.
                  </div>
                )}

                {/* General error */}
                {error && !isLocked && (
                  <div
                    data-ocid="vault.error_state"
                    className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-2xl px-3 py-2"
                  >
                    {error}
                  </div>
                )}

                {isSetup && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-2xl px-3 py-2.5 space-y-1">
                    <p className="font-medium text-foreground/70">
                      Requirements:
                    </p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li
                        className={password.length >= 8 ? "text-success" : ""}
                      >
                        At least 8 characters
                      </li>
                      <li
                        className={
                          password === confirm && confirm.length > 0
                            ? "text-success"
                            : ""
                        }
                      >
                        Passwords match
                      </li>
                    </ul>
                  </div>
                )}

                <Button
                  data-ocid="master_password.submit_button"
                  type="submit"
                  disabled={isLoading || isLocked}
                  className="w-full h-12 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 vault-glow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSetup ? "Creating vault..." : "Unlocking..."}
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      {isSetup ? "Create Vault" : "Unlock Vault"}
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {!isSetup && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Your password is never sent to any server.
          </p>
        )}
      </motion.div>
    </div>
  );
}

export function MasterPasswordGate({
  children,
}: { children: React.ReactNode }) {
  const isFirstUse = !hasSalt();

  // This component just provides the mode; actual rendering in App
  const mode = isFirstUse ? "setup" : "unlock";
  void mode;

  return <>{children}</>;
}
