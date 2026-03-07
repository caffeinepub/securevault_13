import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { Loader2, Lock, Shield } from "lucide-react";
import { motion } from "motion/react";

export function LoginScreen() {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background glow orb */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.18 195) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full mx-auto px-6"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary/10 border border-primary/20 vault-glow">
              <img
                src="/assets/generated/vault-logo-transparent.dim_128x128.png"
                alt="VaultIC"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-primary/30 flex items-center justify-center">
              <Lock className="h-2.5 w-2.5 text-primary" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gradient-cyan">
              VaultIC
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              End-to-end encrypted personal vault
            </p>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full space-y-2"
        >
          {[
            "AES-256-GCM client-side encryption",
            "Tamper-proof on-chain storage",
            "Passwords, notes, cards & more",
          ].map((feat) => (
            <div
              key={feat}
              className="flex items-center gap-2.5 text-sm text-muted-foreground"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              {feat}
            </div>
          ))}
        </motion.div>

        {/* Login button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="w-full"
        >
          <Button
            data-ocid="login.button"
            onClick={login}
            disabled={isLoggingIn || isInitializing}
            className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 vault-glow-strong transition-all"
            size="lg"
          >
            {isLoggingIn || isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Sign in with Internet Identity
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Your master password never leaves your device.
          </p>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/60 hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
