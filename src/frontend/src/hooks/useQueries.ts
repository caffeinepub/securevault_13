import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VaultEntry, backendInterface } from "../backend.d";
import { createActorWithConfig } from "../config";
import { getSecretParameter } from "../utils/urlParams";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// ── Query keys ──────────────────────────────────────────────────────────

export const VAULT_KEYS = {
  entries: ["vault", "entries"] as const,
};

/** Re-fetch a fresh authenticated actor, bypassing any stale anonymous cache. */
async function getFreshActor(
  queryClient: ReturnType<typeof useQueryClient>,
  identity: ReturnType<typeof useInternetIdentity>["identity"],
): Promise<backendInterface> {
  if (!identity) {
    throw new Error("Not authenticated — please sign in again");
  }

  const actorOptions = {
    agentOptions: { identity },
  };

  // createActorWithConfig returns a richer type that includes internal methods;
  // we cast via unknown so both sides are satisfied.
  const actor = (await createActorWithConfig(
    actorOptions,
  )) as unknown as backendInterface & {
    _initializeAccessControlWithSecret(secret: string): Promise<void>;
  };
  const adminToken = getSecretParameter("caffeineAdminToken") || "";
  await actor._initializeAccessControlWithSecret(adminToken);

  // Update the cache so subsequent reads use this actor
  const principalKey = identity.getPrincipal().toString();
  queryClient.setQueryData(["actor", principalKey], actor);

  return actor as backendInterface;
}

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
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
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
      // Use the cached actor if it's ready, otherwise mint a fresh authenticated one
      const resolvedActor =
        !isFetching && actor
          ? actor
          : await getFreshActor(queryClient, identity);
      return resolvedActor.createEntry(
        entryType,
        title,
        encryptedPayload,
        tags,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}

export function useUpdateEntry() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
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
      const resolvedActor =
        !isFetching && actor
          ? actor
          : await getFreshActor(queryClient, identity);
      return resolvedActor.updateEntry(id, title, encryptedPayload, tags);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}

export function useDeleteEntry() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const resolvedActor =
        !isFetching && actor
          ? actor
          : await getFreshActor(queryClient, identity);
      return resolvedActor.deleteEntry(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.entries });
    },
  });
}
