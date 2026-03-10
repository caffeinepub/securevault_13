import type { FailedAttemptLog } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@/hooks/useActor";
import { useQuery } from "@tanstack/react-query";
import { Globe, ShieldAlert, ShieldCheck } from "lucide-react";

interface AccessLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessLogSheet({ open, onOpenChange }: AccessLogSheetProps) {
  const { actor, isFetching } = useActor();

  const { data: logs = [], isLoading } = useQuery<FailedAttemptLog[]>({
    queryKey: ["failedAttemptLogs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFailedAttemptLogs();
    },
    enabled: open && !!actor && !isFetching,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-ocid="access_log.sheet"
        side="right"
        className="w-full sm:max-w-md flex flex-col bg-card border-border pb-safe"
      >
        <SheetHeader className="pb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Access Log
          </SheetTitle>
          <SheetDescription>
            Failed unlock attempts for your vault.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div
              data-ocid="access_log.loading_state"
              className="space-y-3 px-1"
            >
              {(["a", "b", "c", "d"] as const).map((k) => (
                <div
                  key={k}
                  className="rounded-2xl border border-border bg-secondary/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div
              data-ocid="access_log.empty_state"
              className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4"
            >
              <div className="w-14 h-14 rounded-[1.75rem] bg-success/10 border border-success/20 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  No failed attempts recorded
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your vault has no unauthorized access attempts.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full pr-1">
              <div data-ocid="access_log.list" className="space-y-2.5 pb-4">
                {logs.map((log, index) => {
                  const markerIndex = index + 1;
                  const date = new Date(
                    Number(log.timestamp / 1_000_000n),
                  ).toLocaleString();
                  const truncatedUA =
                    log.userAgent.length > 60
                      ? `${log.userAgent.slice(0, 60)}…`
                      : log.userAgent;

                  return (
                    <div
                      key={`${String(log.timestamp)}-${index}`}
                      data-ocid={`access_log.item.${markerIndex}`}
                      className="rounded-2xl border border-border bg-card p-3 space-y-2 shadow-sm hover:border-destructive/20 hover:bg-destructive/[0.02] transition-colors"
                    >
                      {/* Top row: timestamp + attempt badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-foreground font-medium leading-tight">
                          {date}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold shrink-0 border-destructive/30 text-destructive bg-destructive/5 rounded-full px-2 py-0"
                        >
                          Attempt #{String(log.attemptNumber)}
                        </Badge>
                      </div>

                      {/* IP address row */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3 shrink-0 text-primary/70" />
                        <span className="font-medium text-foreground/80">
                          {log.ipAddress || "Unknown"}
                        </span>
                      </div>

                      {/* User agent */}
                      <p className="text-[10px] font-mono-vault text-muted-foreground leading-relaxed truncate">
                        {truncatedUA || "Unknown client"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
