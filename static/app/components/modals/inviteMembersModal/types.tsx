export type InviteStatus = Record<string, {sent: boolean; error?: string}>;

export interface InviteRow {
  emails: Set<string>;
  role: string;
  teams: Set<string>;
}

export interface NormalizedInvite {
  email: string;
  role: string;
  teams: Set<string>;
}
