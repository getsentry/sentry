import {User, Repository} from 'app/types';
import {IncidentActivityType} from './utils';

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
  projects: number[];
  seenBy: User[];
  status: number;
  title: string;
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
