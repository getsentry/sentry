import {SpanEntry} from 'app/views/organizationEventsV2/transactionView/types.tsx';

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

  isBookmarked: boolean;
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

type EntryType = {
  data: {[key: string]: any} | any[];
  type: string;
};

export type EventTag = {key: string; value: string};

type SentryEventBase = {
  id: string;
  eventID: string;
  groupID?: string;
  title: string;
  culprit: string;
  metadata: EventMetadata;
  message: string;
  platform?: string;
  dateCreated?: string;
  endTimestamp?: number;
  entries: EntryType[];

  previousEventID?: string;
  nextEventID?: string;
  projectSlug: string;

  tags: EventTag[];

  size: number;

  location: string;
};

// This type is incomplete
export type Event =
  | ({type: string} & SentryEventBase)
  | {
      type: 'transaction';
      entries: Array<SpanEntry>;
      startTimestamp: number;
      endTimestamp: number;
    } & SentryEventBase;

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

type Metadata = {
  value: string;
  message: string;
  directive: string;
  type: string;
  title: string;
  uri: string;
};

type EventOrGroupType = [
  'error',
  'csp',
  'hpkp',
  'expectct',
  'expectstaple',
  'default',
  'transaction'
];

// TODO: incomplete
export type Group = {
  id: string;
  annotations: string[];
  assignedTo: User;
  count: string;
  culprit: string;
  firstSeen: string;
  hasSeen: boolean;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  lastSeen: string;
  level: string;
  logger: string;
  metadata: Metadata;
  numComments: number;
  permalink: string;
  project: {
    name: string;
    slug: string;
  };
  shareId: string;
  shortId: string;
  status: string;
  statusDetails: {};
  title: string;
  type: EventOrGroupType;
  userCount: number;
  seenBy: User[];
};

export type EventView = {
  id: string;
  name: string;
  data: {
    fields: string[];
    columnNames: string[];
    sort: string[];
    query?: string;

    // TODO: removed as of https://github.com/getsentry/sentry/pull/14321
    // groupby: string[];
    // orderby: string[];
  };
  tags: string[];
  columnWidths: string[];
};
