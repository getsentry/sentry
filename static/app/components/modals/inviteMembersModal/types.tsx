export interface InviteStatus {
  [email: string]: {error?: string; sent: boolean};
}

export interface InviteRow {
  emails: Set<string>;
  teams: Set<string>;
  role: string;
}

export interface NormalizedInvite {
  email: string;
  teams: Set<string>;
  role: string;
}
