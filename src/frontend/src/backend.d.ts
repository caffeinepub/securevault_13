import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface MigrationData {
    entries: Array<[Principal, Array<[string, VaultEntry]>]>;
}
export interface FailedAttemptLog {
    timestamp: bigint;
    userAgent: string;
    ipAddress: string;
    attemptNumber: bigint;
}
export interface VaultEntry {
    id: string;
    title: string;
    entryType: string;
    createdAt: bigint;
    tags: Array<string>;
    updatedAt: bigint;
    encryptedPayload: string;
}
export interface UserProfile {
    name: string;
}
export interface Migration {
    data?: MigrationData;
    name: string;
    version: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createEntry(entryType: string, title: string, encryptedPayload: string, tags: Array<string>): Promise<string>;
    deleteEntry(id: string): Promise<boolean>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getEntries(): Promise<Array<VaultEntry>>;
    getEntriesByTag(tag: string): Promise<Array<VaultEntry>>;
    getEntriesByType(entryType: string): Promise<Array<VaultEntry>>;
    getFailedAttemptLogs(): Promise<Array<FailedAttemptLog>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    logFailedAttempt(ipAddress: string, userAgent: string, attemptNumber: bigint): Promise<void>;
    migrate(migration: Migration): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateEntry(id: string, title: string, encryptedPayload: string, tags: Array<string>): Promise<boolean>;
}
