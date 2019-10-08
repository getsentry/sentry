export type InviteStatus = {[email: string]: {error?: string; sent: boolean}};

export type InviteRow = {
  emails: Set<string>;
  teams: Set<string>;
  role: string;
};

export type NormalizedInvite = {
  email: string;
  teams: Set<string>;
  role: string;
};
