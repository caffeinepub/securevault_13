import { LoginScreen } from "@/components/LoginScreen";
import { MasterPasswordScreen } from "@/components/MasterPasswordScreen";
import { VaultView } from "@/components/VaultView";
import { Toaster } from "@/components/ui/sonner";
import { VaultProvider, useVault } from "@/contexts/VaultContext";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { hasSalt } from "@/lib/crypto";
import { Loader2, Shield } from "lucide-react";

function AppInner() {
  const { identity, isInitializing, isLoggingIn } = useInternetIdentity();
  const { isUnlocked } = useVault();

  // Loading / initializing state
  if (isInitializing || isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse-glow">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isLoggingIn ? "Signing in..." : "Initializing..."}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!identity) {
    return <LoginScreen />;
  }

  // Authenticated but vault locked
  if (!isUnlocked) {
    const mode = hasSalt() ? "unlock" : "setup";
    return <MasterPasswordScreen mode={mode} />;
  }

  // Authenticated and unlocked
  return <VaultView />;
}

export default function App() {
  return (
    <VaultProvider>
      <AppInner />
      <Toaster
        theme="light"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "oklch(1 0 0)",
            border: "1px solid oklch(0.87 0.008 230)",
            color: "oklch(0.15 0.01 240)",
          },
        }}
      />
    </VaultProvider>
  );
}
