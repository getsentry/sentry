export type MissingMemberInvite = {
  commitCount: number;
  email: string;
  externalId: string;
  role: string;
  selected: boolean;
  teams: Set<string>;
};
