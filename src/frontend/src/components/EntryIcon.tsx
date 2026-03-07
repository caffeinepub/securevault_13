import type { EntryType } from "@/lib/entryTypes";
import {
  Code2,
  CreditCard,
  FileText,
  Fingerprint,
  IdCard,
  KeyRound,
  Shield,
  Wifi,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  password: KeyRound,
  note: FileText,
  passkey: Fingerprint,
  credit_card: CreditCard,
  identity: IdCard,
  api_key: Code2,
  wifi: Wifi,
};

const colorMap: Record<string, string> = {
  password: "text-cyan-400 bg-cyan-400/10",
  note: "text-amber-400 bg-amber-400/10",
  passkey: "text-violet-400 bg-violet-400/10",
  credit_card: "text-emerald-400 bg-emerald-400/10",
  identity: "text-blue-400 bg-blue-400/10",
  api_key: "text-orange-400 bg-orange-400/10",
  wifi: "text-sky-400 bg-sky-400/10",
};

interface EntryIconProps {
  type: EntryType | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EntryIcon({
  type,
  size = "md",
  className = "",
}: EntryIconProps) {
  const Icon = iconMap[type] ?? Shield;
  const colors = colorMap[type] ?? "text-muted-foreground bg-muted";

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4.5 w-4.5",
    lg: "h-5 w-5",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg ${sizeClasses[size]} ${colors} flex-shrink-0 ${className}`}
    >
      <Icon className={iconSizes[size]} />
    </div>
  );
}
