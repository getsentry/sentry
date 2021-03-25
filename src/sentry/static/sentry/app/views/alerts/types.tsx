import {Repository, User} from 'app/types';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

type Data = [number, {count: number}[]][];

export type Incident = {
  dateClosed: string | null;
  dateStarted: string;
  dateDetected: string;
  dateCreated: string;
  id: string;
  identifier: string;
  isSubscribed: boolean;
  groups: string[]; // Array of group ids
  discoverQuery: string;
  organizationId: string;
  projects: string[]; // Array of slugs
  seenBy: User[];
  status: IncidentStatus;
  statusMethod: IncidentStatusMethod;
  title: string;
  hasSeen: boolean;
  alertRule: IncidentRule;
  activities?: ActivityType[];
};

export type IncidentStats = {
  eventStats: {
    data: Data;
  };
  totalEvents: number;
  uniqueUsers: number;
};

export type IncidentSuspect = {
  author: User;
  dateCreated: string;
  id: string;
  message: string;
  repository: Repository;
};

export type ActivityTypeDraft = {
  comment: null | string;
  dateCreated: string;
  id: string;
  incidentIdentifier: string;
  type: IncidentActivityType;
  user: User | null;
};

export type ActivityType = ActivityTypeDraft & {
  eventStats?: {data: Data};
  previousValue: string | null;
  value: string | null;
};

export enum IncidentType {
  DETECTED,
  CREATED,
  TRIGGERED,
}

export enum IncidentActivityType {
  CREATED = 0,
  DETECTED = 1,
  STATUS_CHANGE = 2,
  COMMENT = 3,
  STARTED = 4,
}

export enum IncidentStatus {
  OPENED = 1,
  CLOSED = 2,
  WARNING = 10,
  CRITICAL = 20,
}

export enum IncidentStatusMethod {
  MANUAL = 1,
  RULE_UPDATED = 2,
  RULE_TRIGGERED = 3,
}

export enum AlertRuleStatus {
  PENDING = 0,
  SNAPSHOT = 4,
  DISABLED = 5,
}
