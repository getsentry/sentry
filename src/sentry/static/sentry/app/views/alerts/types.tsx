import {IncidentRule} from 'app/views/settings/incidentRules/types';
import {User, Repository} from 'app/types';

type Data = [number, {count: number}[]][];

export type Incident = {
  dateClosed: string;
  dateStarted: string;
  dateDetected: string;
  dateCreated: string;
  eventStats: {
    data: Data;
  };
  id: string;
  identifier: string;
  isSubscribed: boolean;
  groups: string[]; // Array of group ids
  query: string;
  organizationId: string;
  projects: string[]; // Array of slugs
  seenBy: User[];
  status: number;
  title: string;
  totalEvents: number;
  uniqueUsers: number;
  alertRule: IncidentRule;
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
  user: User;
};

export type ActivityType = ActivityTypeDraft & {
  eventStats: {data: Data};
  previousValue: null;
  value: null;
};

export type NoteType = {
  text: string;
  mentions: [string, string][];
};

export enum IncidentType {
  DETECTED,
  CREATED,
  TRIGGERED,
}

export enum IncidentActivityType {
  CREATED,
  DETECTED,
  STATUS_CHANGE,
  COMMENT,
}

export enum IncidentStatus {
  OPENED = 1,
  CLOSED = 2,
  WARNING = 10,
  CRITICAL = 20,
}
