export type InviteStatus = {[email: string]: {sent: boolean; error?: string}};

export type InviteRow = {
  emails: Set<string>;
  role: string;
  teams: Set<string>;
};

export type NormalizedInvite = {
  email: string;
  role: string;
  teams: Set<string>;
};
