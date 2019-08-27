import {User, Group, Repository} from 'app/types';

export type Incident = {
  dateClosed: string;
  dateStarted: string;
  dateDetected: string;
  dateAdded: string;
  eventStats: {
    data: [number, {count: number}[]][];
  };
  id: string;
  identifier: string;
  isSubscribed: boolean;
  groups: Group[];
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
