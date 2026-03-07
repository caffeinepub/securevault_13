import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VaultEntry } from "../backend.d";
import { useActor } from "./useActor";

// ── Query keys ──────────────────────────────────────────────────────────

export const VAULT_KEYS = {
  entries: ["vault", "entries"] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────

export function useGetEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<VaultEntry[]>({
    queryKey: VAULT_KEYS.entries,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getEntries();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────

export function useCreateEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryType,
      title,
      encryptedPayload,
      tags,
    }: {
      entryType: string;
      title: string;
      encryptedPayload: string;
      tags: string[];
    }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.createEntry(entryType, title, encryptedPayload, tags);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}

export function useUpdateEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      encryptedPayload,
      tags,
    }: {
      id: string;
      title: string;
      encryptedPayload: string;
      tags: string[];
    }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.updateEntry(id, title, encryptedPayload, tags);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}

export function useDeleteEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.deleteEntry(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}
