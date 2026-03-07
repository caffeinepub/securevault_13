import type { VaultEntry } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVault } from "@/contexts/VaultContext";
import { useGetEntries } from "@/hooks/useQueries";
import { decryptPayload } from "@/lib/crypto";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { ENTRY_TYPE_LABELS, FILTER_TABS } from "@/lib/entryTypes";
import {
  AlertCircle,
  Clock,
  Lock,
  Plus,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntryDetailSheet } from "./EntryDetailSheet";
import { EntryFormSheet } from "./EntryFormSheet";
import { EntryIcon } from "./EntryIcon";
import { SettingsSheet } from "./SettingsSheet";

type DecryptedEntry = VaultEntry & {
  decryptedPayload?: Record<string, unknown>;
};

export function VaultView() {
  const { cryptoKey, lock } = useVault();
  const { data: entries = [], isLoading, isError } = useGetEntries();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [decryptedEntries, setDecryptedEntries] = useState<
    Map<string, Record<string, unknown>>
  >(new Map());
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [_decryptError, setDecryptError] = useState<string | null>(null);

  // Sheets
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<DecryptedEntry | null>(null);
  const [editEntry, setEditEntry] = useState<DecryptedEntry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Decrypt all entries when they load
  const decryptAll = useCallback(async () => {
    if (!cryptoKey || entries.length === 0) return;
    setIsDecrypting(true);
    setDecryptError(null);

    try {
      const results = await Promise.all(
        entries.map(async (entry) => {
          try {
            const payload = await decryptPayload(
              cryptoKey,
              entry.encryptedPayload,
            );
            return { id: entry.id, payload };
          } catch {
            return { id: entry.id, payload: {} };
          }
        }),
      );

      const newMap = new Map<string, Record<string, unknown>>();
      for (const r of results) {
        newMap.set(r.id, r.payload);
      }
      setDecryptedEntries(newMap);
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : "Decryption failed");
    } finally {
      setIsDecrypting(false);
    }
  }, [cryptoKey, entries]);

  useEffect(() => {
    void decryptAll();
  }, [decryptAll]);

  // Build enriched entry list
  const enrichedEntries = useMemo<DecryptedEntry[]>(() => {
    return entries.map((e) => ({
      ...e,
      decryptedPayload: decryptedEntries.get(e.id),
    }));
  }, [entries, decryptedEntries]);

  // Filter & search
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedEntries.filter((entry) => {
      const typeMatch =
        activeFilter === "all" || entry.entryType === activeFilter;
      if (!typeMatch) return false;
      if (!q) return true;

      // Search in title, tags, type label
      const titleMatch = entry.title.toLowerCase().includes(q);
      const tagMatch = entry.tags.some((t) => t.toLowerCase().includes(q));
      const typeLabel = (
        ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType
      ).toLowerCase();
      const typeMatch2 = typeLabel.includes(q);

      return titleMatch || tagMatch || typeMatch2;
    });
  }, [enrichedEntries, activeFilter, search]);

  function openDetail(entry: DecryptedEntry) {
    setDetailEntry(entry);
  }

  function handleEditFromDetail() {
    if (detailEntry) {
      setEditEntry(detailEntry);
      setDetailEntry(null);
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-bold text-sm tracking-tight hidden sm:block text-gradient-cyan">
                VaultIC
              </span>
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                data-ocid="vault.search_input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vault..."
                className="pl-9 h-9 bg-secondary/50 border-border focus:border-primary/50 text-sm text-base"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-ocid="settings.open_modal_button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-ocid="lock.button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-primary"
                    onClick={lock}
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lock Vault</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="sticky top-[57px] z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center gap-0.5 overflow-x-auto py-2 scrollbar-hide">
              {FILTER_TABS.map((tab) => {
                const count =
                  tab.value === "all"
                    ? entries.length
                    : entries.filter((e) => e.entryType === tab.value).length;
                const isActive = activeFilter === tab.value;

                return (
                  <button
                    type="button"
                    key={tab.value}
                    data-ocid="vault.filter.tab"
                    onClick={() => setActiveFilter(tab.value)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-md text-sm whitespace-nowrap transition-colors font-medium ${
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 pb-28">
          {/* Loading state */}
          {(isLoading || isDecrypting) && (
            <div data-ocid="vault.loading_state" className="space-y-3">
              {["sk1", "sk2", "sk3", "sk4", "sk5"].map((sk) => (
                <div
                  key={sk}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
                >
                  <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div
              data-ocid="vault.error_state"
              className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Failed to load vault entries. Please try refreshing.
              </p>
            </div>
          )}

          {/* Entries */}
          {!isLoading && !isDecrypting && !isError && (
            <AnimatePresence mode="popLayout">
              {filteredEntries.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  data-ocid="vault.empty_state"
                  className="flex flex-col items-center gap-4 py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
                    <Shield className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      {search
                        ? "No entries found"
                        : entries.length === 0
                          ? "Your vault is empty"
                          : "No entries in this category"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {search
                        ? `No entries match "${search}"`
                        : "Add your first entry to get started"}
                    </p>
                  </div>
                  {!search && (
                    <Button
                      onClick={() => setAddSheetOpen(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add First Entry
                    </Button>
                  )}
                </motion.div>
              ) : (
                <div data-ocid="vault.list" className="space-y-2">
                  {filteredEntries.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      data-ocid={`vault.item.${i + 1}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <EntryCard
                        entry={entry}
                        onClick={() => openDetail(entry)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}
        </main>

        {/* FAB */}
        <div className="fixed bottom-6 right-6 z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-ocid="vault.add_button"
                onClick={() => setAddSheetOpen(true)}
                size="lg"
                className="h-14 w-14 rounded-full shadow-glow-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
                aria-label="Add entry"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add Entry</TooltipContent>
          </Tooltip>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 py-3 text-center">
          <p className="text-xs text-muted-foreground/40">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/40 hover:text-primary/60 transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </footer>

        {/* Sheets */}
        <EntryFormSheet
          open={addSheetOpen}
          onOpenChange={(v) => {
            setAddSheetOpen(v);
            if (!v) setEditEntry(null);
          }}
        />

        {editEntry && (
          <EntryFormSheet
            open={!!editEntry}
            onOpenChange={(v) => {
              if (!v) setEditEntry(null);
            }}
            editEntry={editEntry}
          />
        )}

        {detailEntry && (
          <EntryDetailSheet
            open={!!detailEntry}
            onOpenChange={(v) => {
              if (!v) setDetailEntry(null);
            }}
            entry={detailEntry}
            onEdit={handleEditFromDetail}
          />
        )}

        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </TooltipProvider>
  );
}

// ── Entry Card ──────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: DecryptedEntry;
  onClick: () => void;
}

function EntryCard({ entry, onClick }: EntryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 p-4 min-h-[60px] rounded-xl border border-border bg-card entry-card-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <EntryIcon type={entry.entryType} size="md" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {entry.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
          </span>
          {entry.tags.length > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <div className="flex gap-1 overflow-hidden">
                {entry.tags.slice(0, 2).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs h-4 px-1.5 py-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {entry.tags.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{entry.tags.length - 2}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
        <Clock className="h-3 w-3" />
        {formatDistanceToNow(Number(entry.updatedAt) / 1_000_000)}
      </div>
    </button>
  );
}
