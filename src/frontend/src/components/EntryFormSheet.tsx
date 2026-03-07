import type { VaultEntry } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useVault } from "@/contexts/VaultContext";
import { useActor } from "@/hooks/useActor";
import { useCreateEntry, useUpdateEntry } from "@/hooks/useQueries";
import { encryptPayload, generatePassword } from "@/lib/crypto";
import {
  ENTRY_TYPES,
  type EntryType,
  type EntryTypeDef,
} from "@/lib/entryTypes";
import { Eye, EyeOff, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EntryIcon } from "./EntryIcon";

interface EntryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, we're in edit mode */
  editEntry?: VaultEntry & { decryptedPayload?: Record<string, unknown> };
}

export function EntryFormSheet({
  open,
  onOpenChange,
  editEntry,
}: EntryFormSheetProps) {
  const { cryptoKey } = useVault();
  const { isFetching: isActorFetching } = useActor();
  const createMutation = useCreateEntry();
  const updateMutation = useUpdateEntry();

  const isEdit = !!editEntry;

  // ── State ────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<EntryType>("password");
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Initialize form when opening
  useEffect(() => {
    if (open) {
      if (isEdit && editEntry) {
        setSelectedType(editEntry.entryType as EntryType);
        setTitle(editEntry.title);
        setTags([...editEntry.tags]);
        if (editEntry.decryptedPayload) {
          const fieldVals: Record<string, string> = {};
          for (const [k, v] of Object.entries(editEntry.decryptedPayload)) {
            fieldVals[k] = String(v ?? "");
          }
          setFields(fieldVals);
        }
      } else {
        setSelectedType("password");
        setTitle("");
        setFields({});
        setTags([]);
        setTagInput("");
        setShowSecret({});
      }
    }
  }, [open, isEdit, editEntry]);

  const typeDef: EntryTypeDef | undefined = ENTRY_TYPES.find(
    (t) => t.type === selectedType,
  );

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSecret(key: string) {
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cryptoKey) return;
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }

    try {
      // Build payload from current fields
      const payload: Record<string, string> = {};
      if (typeDef) {
        for (const field of typeDef.fields) {
          payload[field.key] = fields[field.key] ?? "";
        }
      }

      const encrypted = await encryptPayload(cryptoKey, payload);

      if (isEdit && editEntry) {
        await updateMutation.mutateAsync({
          id: editEntry.id,
          title: title.trim(),
          encryptedPayload: encrypted,
          tags,
        });
        toast.success("Entry updated");
      } else {
        await createMutation.mutateAsync({
          entryType: selectedType,
          title: title.trim(),
          encryptedPayload: encrypted,
          tags,
        });
        toast.success("Entry saved to vault");
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || isActorFetching;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-ocid="entry.dialog"
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-card border-border"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            {typeDef && <EntryIcon type={selectedType} size="sm" />}
            {isEdit ? "Edit Entry" : "Add New Entry"}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            {isEdit
              ? "Update the entry fields below."
              : "All fields are encrypted before saving."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 py-2">
          {/* Type selector (add mode only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Entry Type</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => {
                  setSelectedType(v as EntryType);
                  setFields({});
                  setShowSecret({});
                }}
              >
                <SelectTrigger
                  data-ocid="entry.type.select"
                  className="bg-secondary/50 border-border"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      <div className="flex items-center gap-2">
                        <EntryIcon type={t.type} size="sm" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="entry-title"
              data-ocid="entry.title.input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                selectedType === "password"
                  ? "e.g. GitHub Account"
                  : selectedType === "note"
                    ? "e.g. SSH Keys"
                    : "Entry name"
              }
              className="bg-secondary/50 border-border focus:border-primary/50 text-base"
              autoFocus={!isEdit}
            />
          </div>

          {/* Dynamic fields */}
          {typeDef?.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label
                htmlFor={`field-${field.key}`}
                className="text-sm font-medium"
              >
                {field.label}
              </Label>

              {field.type === "textarea" ? (
                <Textarea
                  id={`field-${field.key}`}
                  value={fields[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  className={`bg-secondary/50 border-border focus:border-primary/50 resize-none text-base ${
                    field.secret ? "font-mono" : ""
                  }`}
                />
              ) : field.type === "select" ? (
                <Select
                  value={fields[field.key] ?? ""}
                  onValueChange={(v) => setField(field.key, v)}
                >
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt === "national_id"
                          ? "National ID"
                          : opt === "drivers_license"
                            ? "Driver's License"
                            : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Input
                    id={`field-${field.key}`}
                    type={
                      field.secret && !showSecret[field.key]
                        ? "password"
                        : field.type === "url"
                          ? "url"
                          : "text"
                    }
                    value={fields[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={`bg-secondary/50 border-border focus:border-primary/50 text-base ${
                      field.secret ? "font-mono tracking-wide" : ""
                    } ${field.secret || field.generatePassword ? "pr-20" : ""}`}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {field.generatePassword && (
                      <button
                        type="button"
                        onClick={() =>
                          setField(field.key, generatePassword(16))
                        }
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                        title="Generate password"
                        tabIndex={-1}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => toggleSecret(field.key)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        tabIndex={-1}
                        aria-label={showSecret[field.key] ? "Hide" : "Show"}
                      >
                        {showSecret[field.key] ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tags</Label>
            <div className="min-h-[40px] flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-secondary/50 focus-within:border-primary/50 transition-colors">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive transition-colors ml-0.5"
                    tabIndex={-1}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                placeholder={tags.length === 0 ? "Add tags..." : ""}
                className="flex-1 min-w-[80px] bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or comma to add a tag
            </p>
          </div>

          <SheetFooter className="pt-2 flex gap-2">
            <SheetClose asChild>
              <Button
                data-ocid="entry.cancel_button"
                type="button"
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </SheetClose>
            <Button
              data-ocid="entry.save_button"
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Update Entry"
              ) : (
                "Save to Vault"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
