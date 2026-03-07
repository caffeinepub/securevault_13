import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useVault } from "@/contexts/VaultContext";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useGetEntries, useUpdateEntry } from "@/hooks/useQueries";
import {
  enrollBiometric,
  isBiometricEnrolled,
  isBiometricSupported,
  removeBiometric,
} from "@/lib/biometrics";
import {
  createAndStoreSalt,
  decryptPayload,
  deriveKey,
  encryptPayload,
  getSalt,
} from "@/lib/crypto";
import {
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  Lock,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const AUTO_LOCK_OPTIONS = [
  { value: "1", label: "1 minute" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "0", label: "Never" },
];

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const {
    autoLockMinutes,
    setAutoLockMinutes,
    cryptoKey,
    lock,
    biometricEnrolled,
    refreshBiometricStatus,
  } = useVault();
  const { clear } = useInternetIdentity();
  const { data: entries = [] } = useGetEntries();
  const updateMutation = useUpdateEntry();

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Biometrics state
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const bioSupported = isBiometricSupported();
  const bioEnrolled = biometricEnrolled || isBiometricEnrolled();

  async function handleChangeMasterPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!cryptoKey) return;

    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsChangingPw(true);
    try {
      // Verify current password by re-deriving
      const salt = getSalt();
      if (!salt) throw new Error("Salt not found");

      const currentKey = await deriveKey(currentPw, salt);

      // Verify by decrypting the first entry (if any)
      if (entries.length > 0) {
        try {
          await decryptPayload(currentKey, entries[0].encryptedPayload);
        } catch {
          throw new Error("Current password is incorrect.");
        }
      }

      // Create new salt and derive new key
      const newSalt = createAndStoreSalt();
      const newKey = await deriveKey(newPw, newSalt);

      // Re-encrypt all entries
      const reEncryptPromises = entries.map(async (entry) => {
        const plain = await decryptPayload(currentKey, entry.encryptedPayload);
        const newEncrypted = await encryptPayload(newKey, plain);
        return updateMutation.mutateAsync({
          id: entry.id,
          title: entry.title,
          encryptedPayload: newEncrypted,
          tags: entry.tags,
        });
      });

      await Promise.all(reEncryptPromises);

      toast.success("Master password changed. Vault will lock now.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      lock();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setIsChangingPw(false);
    }
  }

  async function handleEnrollBiometrics() {
    if (!cryptoKey) return;
    setIsEnrollingBio(true);
    try {
      await enrollBiometric(cryptoKey);
      refreshBiometricStatus();
      toast.success("Biometrics enabled successfully.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to enable biometrics.",
      );
    } finally {
      setIsEnrollingBio(false);
    }
  }

  function handleRemoveBiometrics() {
    removeBiometric();
    refreshBiometricStatus();
    toast.success("Biometrics removed.");
  }

  function handleSignOut() {
    lock();
    clear();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-ocid="settings.dialog"
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-card border-border"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Settings
          </SheetTitle>
          <SheetDescription>Configure your vault preferences.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Auto-lock */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Auto-Lock Timeout
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vault locks after this period of inactivity.
              </p>
            </div>
            <Select
              value={String(autoLockMinutes)}
              onValueChange={(v) => setAutoLockMinutes(Number(v))}
            >
              <SelectTrigger
                data-ocid="settings.autlock_timeout.select"
                className="bg-secondary/50 border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Biometrics */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Fingerprint className="h-3.5 w-3.5 text-primary" />
                Biometrics
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use Face ID, Touch ID, or fingerprint to unlock your vault.
              </p>
            </div>

            {!bioSupported ? (
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2.5">
                Biometric authentication is not supported on this device.
              </p>
            ) : bioEnrolled ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/20 rounded-md px-3 py-2">
                  <Fingerprint className="h-3.5 w-3.5 flex-shrink-0" />
                  Biometric unlock is enabled.
                </div>
                <Button
                  data-ocid="settings.biometrics.delete_button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBiometrics}
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  Remove Biometrics
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Biometric unlock is not set up.
                </p>
                <Button
                  data-ocid="settings.biometrics.primary_button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleEnrollBiometrics()}
                  disabled={isEnrollingBio || !cryptoKey}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isEnrollingBio ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="mr-2 h-3.5 w-3.5" />
                      Set Up Biometrics
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Change master password */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Change Master Password
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                All entries will be re-encrypted with the new password.
                {entries.length > 0 && (
                  <span className="text-warning">
                    {" "}
                    ({entries.length}{" "}
                    {entries.length === 1 ? "entry" : "entries"} will be
                    re-encrypted)
                  </span>
                )}
              </p>
            </div>

            <form
              onSubmit={(e) => void handleChangeMasterPassword(e)}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Current master password"
                    className="pr-10 bg-secondary/50 border-border font-mono text-sm"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showCurrentPw ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New master password (8+ chars)"
                    className="pr-10 bg-secondary/50 border-border font-mono text-sm"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNewPw ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-secondary/50 border-border font-mono text-sm"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isChangingPw || !currentPw || !newPw || !confirmPw}
                className="w-full border-primary/30 text-primary hover:bg-primary/10"
              >
                {isChangingPw ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Re-encrypting...
                  </>
                ) : (
                  "Change Master Password"
                )}
              </Button>
            </form>
          </div>

          <Separator />

          {/* Sign out */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Session
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
