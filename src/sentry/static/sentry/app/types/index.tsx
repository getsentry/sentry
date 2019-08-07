export type Organization = {
  id: string;
  slug: string;
  projects: Project[];
  access: string[];
  features: string[];
};

export type Project = {
  id: string;
  slug: string;
  isMember: boolean;
  teams: Team[];
  features: string[];
};

export type Team = {
  id: string;
  slug: string;
  isMember: boolean;
};

// This type is incomplete
export type EventMetadata = {
  value?: string;
  message?: string;
  directive?: string;
  type?: string;
  title?: string;
  uri?: string;
  filename?: string;
  origin?: string;
  function?: string;
};

// This type is incomplete
export type Event = {
  id: string;
  eventID: string;
  groupID?: string;
  type: string;
  title: string;
  culprit: string;
  metadata: EventMetadata;
  message: string;
  platform?: string;
};

export type EventsStatsData = [number, {count: number}[]][];

export type EventsStats = {
  data: EventsStatsData;
  totals?: {count: number};
};

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type CommitAuthor = {
  email?: string;
  name?: string;
};
