import type {User} from 'sentry/types/user';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

type Data = Array<[number, Array<{count: number}>]>;

export type Incident = {
  alertRule: MetricRule;
  dateClosed: string | null;
  dateCreated: string;
  dateDetected: string;
  dateStarted: string;
  // Array of group ids
  discoverQuery: string;
  groups: string[];
  hasSeen: boolean;
  id: string;
  identifier: string;
  isSubscribed: boolean;
  organizationId: string;
  projects: string[];
  // Array of slugs
  seenBy: User[];
  status: IncidentStatus;
  statusMethod: IncidentStatusMethod;
  title: string;
  activities?: ActivityType[];
};

/** @internal exported for tests */
export type IncidentStats = {
  eventStats: {
    data: Data;
  };
  totalEvents: number;
  uniqueUsers: number;
};

type ActivityTypeDraft = {
  comment: null | string;
  dateCreated: string;
  id: string;
  incidentIdentifier: string;
  type: IncidentActivityType;
  user: User | null;
};

type ActivityType = ActivityTypeDraft & {
  previousValue: string | null;
  value: string | null; // determines IncidentStatus of the activity (CRITICAL/WARNING/etc.)
  eventStats?: {data: Data};
};

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

export enum CombinedAlertType {
  METRIC = 'alert_rule',
  ISSUE = 'rule',
  UPTIME = 'uptime',
  CRONS = 'monitor',
}

export type Anomaly = {
  anomaly: {anomaly_score: number; anomaly_type: AnomalyType};
  timestamp: number;
  value: number;
};

export enum AnomalyType {
  HIGH_CONFIDENCE = 'anomaly_higher_confidence',
  LOW_CONFIDENCE = 'anomaly_lower_confidence',
  NONE = 'none',
  NO_DATA = 'no_data',
}
