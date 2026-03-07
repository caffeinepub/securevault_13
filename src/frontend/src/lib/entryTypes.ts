/**
 * Vault entry type definitions and metadata.
 */

export type EntryType =
  | "password"
  | "note"
  | "passkey"
  | "credit_card"
  | "identity"
  | "api_key"
  | "wifi";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "textarea" | "select";
  secret?: boolean; // masked by default
  options?: string[]; // for select type
  placeholder?: string;
  generatePassword?: boolean; // show password generator button
  copyable?: boolean;
}

export interface EntryTypeDef {
  type: EntryType;
  label: string;
  icon: string; // lucide icon name (used in component)
  color: string; // tailwind color class for the icon badge
  fields: FieldDef[];
}

export const ENTRY_TYPES: EntryTypeDef[] = [
  {
    type: "password",
    label: "Password",
    icon: "KeyRound",
    color: "text-cyan-400 bg-cyan-400/10",
    fields: [
      {
        key: "username",
        label: "Username / Email",
        type: "text",
        placeholder: "user@example.com",
        copyable: true,
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        secret: true,
        generatePassword: true,
        copyable: true,
      },
      {
        key: "url",
        label: "Website URL",
        type: "url",
        placeholder: "https://example.com",
        copyable: true,
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
  {
    type: "note",
    label: "Secure Note",
    icon: "FileText",
    color: "text-amber-400 bg-amber-400/10",
    fields: [
      {
        key: "content",
        label: "Content",
        type: "textarea",
        secret: true,
        placeholder: "Write your secure note here...",
        copyable: true,
      },
    ],
  },
  {
    type: "passkey",
    label: "Passkey",
    icon: "Fingerprint",
    color: "text-violet-400 bg-violet-400/10",
    fields: [
      {
        key: "service",
        label: "Service / Application",
        type: "text",
        placeholder: "e.g. GitHub",
        copyable: true,
      },
      {
        key: "keyMaterial",
        label: "Key Material",
        type: "textarea",
        secret: true,
        copyable: true,
        placeholder: "Paste key material...",
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
  {
    type: "credit_card",
    label: "Credit Card",
    icon: "CreditCard",
    color: "text-emerald-400 bg-emerald-400/10",
    fields: [
      {
        key: "cardholderName",
        label: "Cardholder Name",
        type: "text",
        placeholder: "Jane Smith",
        copyable: true,
      },
      {
        key: "cardNumber",
        label: "Card Number",
        type: "text",
        secret: true,
        placeholder: "•••• •••• •••• ••••",
        copyable: true,
      },
      {
        key: "expiry",
        label: "Expiry Date",
        type: "text",
        placeholder: "MM/YY",
        copyable: true,
      },
      {
        key: "cvv",
        label: "CVV",
        type: "text",
        secret: true,
        placeholder: "•••",
        copyable: true,
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
  {
    type: "identity",
    label: "Identity Document",
    icon: "IdCard",
    color: "text-blue-400 bg-blue-400/10",
    fields: [
      {
        key: "documentType",
        label: "Document Type",
        type: "select",
        options: ["passport", "national_id", "drivers_license"],
        placeholder: "Select type",
      },
      {
        key: "documentNumber",
        label: "Document Number",
        type: "text",
        secret: true,
        copyable: true,
        placeholder: "AB1234567",
      },
      {
        key: "issuer",
        label: "Issuing Authority / Country",
        type: "text",
        placeholder: "e.g. USA",
        copyable: true,
      },
      {
        key: "expiryDate",
        label: "Expiry Date",
        type: "text",
        placeholder: "YYYY-MM-DD",
        copyable: true,
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
  {
    type: "api_key",
    label: "API Key",
    icon: "Code2",
    color: "text-orange-400 bg-orange-400/10",
    fields: [
      {
        key: "service",
        label: "Service / Provider",
        type: "text",
        placeholder: "e.g. OpenAI",
        copyable: true,
      },
      {
        key: "token",
        label: "API Token / Key",
        type: "password",
        secret: true,
        copyable: true,
        placeholder: "sk-...",
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
  {
    type: "wifi",
    label: "Wi-Fi Network",
    icon: "Wifi",
    color: "text-sky-400 bg-sky-400/10",
    fields: [
      {
        key: "ssid",
        label: "Network Name (SSID)",
        type: "text",
        placeholder: "My Home Network",
        copyable: true,
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        secret: true,
        generatePassword: false,
        copyable: true,
        placeholder: "",
      },
      {
        key: "securityType",
        label: "Security Type",
        type: "select",
        options: ["WPA2", "WPA3", "WPA", "WEP", "None"],
        placeholder: "Select security",
      },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "" },
    ],
  },
];

export function getEntryTypeDef(type: string): EntryTypeDef | undefined {
  return ENTRY_TYPES.find((e) => e.type === type);
}

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  password: "Password",
  note: "Note",
  passkey: "Passkey",
  credit_card: "Card",
  identity: "Identity",
  api_key: "API Key",
  wifi: "Wi-Fi",
};

export const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "password", label: "Passwords" },
  { value: "note", label: "Notes" },
  { value: "passkey", label: "Passkeys" },
  { value: "credit_card", label: "Cards" },
  { value: "identity", label: "Identity" },
  { value: "api_key", label: "API Keys" },
  { value: "wifi", label: "Wi-Fi" },
] as const;
