import type { VaultEntry } from "@/backend.d";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDeleteEntry } from "@/hooks/useQueries";
import { isBiometricEnrolled, verifyBiometric } from "@/lib/biometrics";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { getEntryTypeDef } from "@/lib/entryTypes";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EntryIcon } from "./EntryIcon";

interface EntryDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: VaultEntry & { decryptedPayload?: Record<string, unknown> };
  onEdit: () => void;
}

export function EntryDetailSheet({
  open,
  onOpenChange,
  entry,
  onEdit,
}: EntryDetailSheetProps) {
  const deleteMutation = useDeleteEntry();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  // Biometric re-auth state — reset when sheet closes
  const [sheetBioAuthed, setSheetBioAuthed] = useState(false);
  const [bioVerifying, setBioVerifying] = useState(false);

  // Reset bio auth when sheet closes/reopens
  useEffect(() => {
    if (!open) {
      setSheetBioAuthed(false);
      setRevealed({});
      setCopied({});
    }
  }, [open]);

  const bioEnrolled = isBiometricEnrolled();

  const typeDef = getEntryTypeDef(entry.entryType);

  async function requireBioAuth(): Promise<boolean> {
    if (!bioEnrolled || sheetBioAuthed) return true;
    setBioVerifying(true);
    try {
      await verifyBiometric();
      setSheetBioAuthed(true);
      return true;
    } catch {
      toast.error("Biometric verification failed");
      return false;
    } finally {
      setBioVerifying(false);
    }
  }

  async function toggleReveal(key: string, isSecret: boolean) {
    // If revealing a secret field and bio is enrolled but not authed
    if (isSecret && !revealed[key]) {
      const authed = await requireBioAuth();
      if (!authed) return;
    }
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function copyField(key: string, value: string, isSecret: boolean) {
    // Gate secret fields behind biometric
    if (isSecret) {
      const authed = await requireBioAuth();
      if (!authed) return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied((prev) => ({ ...prev, [key]: true }));
      toast.success("Copied to clipboard");
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(entry.id);
      toast.success("Entry deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  const payload = entry.decryptedPayload ?? {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-card border-border"
      >
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <EntryIcon type={entry.entryType} size="md" />
              <div className="min-w-0">
                <SheetTitle className="text-foreground text-left truncate">
                  {entry.title}
                </SheetTitle>
                <SheetDescription className="text-left text-xs">
                  {typeDef?.label ?? entry.entryType} ·{" "}
                  {formatDistanceToNow(Number(entry.updatedAt) / 1_000_000)}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                data-ocid="entry.edit_button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    data-ocid="entry.delete_button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &ldquo;{entry.title}
                      &rdquo;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-ocid="entry.cancel_button">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      data-ocid="entry.confirm_button"
                      onClick={() => void handleDelete()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetHeader>

        <Separator className="mb-5" />

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Fields */}
        {!entry.decryptedPayload ? (
          <div
            data-ocid="entry.loading_state"
            className="flex items-center gap-2 text-muted-foreground py-4"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Decrypting...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {typeDef?.fields.map((fieldDef) => {
              const value = String(payload[fieldDef.key] ?? "");
              if (!value) return null;

              const isHidden = fieldDef.secret && !revealed[fieldDef.key];
              const isCopied = copied[fieldDef.key];
              const isUrl = fieldDef.type === "url";
              // Show fingerprint indicator when bio is enrolled and not yet authed for this session
              const showBioIndicator =
                fieldDef.secret && bioEnrolled && !sheetBioAuthed;

              return (
                <div key={fieldDef.key} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {fieldDef.label}
                    </p>
                    {showBioIndicator && (
                      <Fingerprint className="h-3 w-3 text-primary/60" />
                    )}
                  </div>
                  <div className="flex items-start gap-2 group">
                    <div
                      className={`flex-1 min-w-0 rounded-md px-3 py-2 bg-secondary/40 border border-border/60 text-sm break-all ${
                        fieldDef.secret ? "font-mono" : ""
                      }`}
                    >
                      {fieldDef.type === "textarea" ? (
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {isHidden
                            ? "•".repeat(Math.min(value.length, 32))
                            : value}
                        </pre>
                      ) : (
                        <span
                          className={
                            isHidden ? "tracking-[0.2em] select-none" : ""
                          }
                        >
                          {isHidden
                            ? "•".repeat(Math.min(value.length, 24))
                            : value}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {fieldDef.secret && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            void toggleReveal(
                              fieldDef.key,
                              fieldDef.secret ?? false,
                            )
                          }
                          disabled={bioVerifying}
                          title={revealed[fieldDef.key] ? "Hide" : "Reveal"}
                        >
                          {bioVerifying && showBioIndicator ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : revealed[fieldDef.key] ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {fieldDef.copyable !== false && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() =>
                            void copyField(
                              fieldDef.key,
                              value,
                              fieldDef.secret ?? false,
                            )
                          }
                          disabled={bioVerifying}
                          title="Copy"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : bioVerifying && showBioIndicator ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {isUrl && value && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            window.open(value, "_blank", "noopener")
                          }
                          title="Open URL"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timestamps */}
        <div className="mt-6 pt-4 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
          <p>
            Created:{" "}
            {new Date(Number(entry.createdAt) / 1_000_000).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "long", day: "numeric" },
            )}
          </p>
          <p>
            Updated:{" "}
            {new Date(Number(entry.updatedAt) / 1_000_000).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "long", day: "numeric" },
            )}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
