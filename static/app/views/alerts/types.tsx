import type {AlertRuleActivation, IssueAlertRule} from 'sentry/types/alerts';
import type {User} from 'sentry/types/user';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

type Data = [number, {count: number}[]][];

export enum AlertRuleType {
  METRIC = 'metric',
  ISSUE = 'issue',
}

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
  activation?: AlertRuleActivation;
  activities?: ActivityType[];
};

export type IncidentStats = {
  eventStats: {
    data: Data;
  };
  totalEvents: number;
  uniqueUsers: number;
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

export enum ActivationStatus {
  WAITING = 0,
  MONITORING = 1,
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
}

export interface IssueAlert extends IssueAlertRule {
  type: CombinedAlertType.ISSUE;
  latestIncident?: Incident | null;
}

export interface MetricAlert extends MetricRule {
  type: CombinedAlertType.METRIC;
}

export interface UptimeAlert extends UptimeRule {
  type: CombinedAlertType.UPTIME;
}

export type CombinedMetricIssueAlerts = IssueAlert | MetricAlert;

export type CombinedAlerts = CombinedMetricIssueAlerts | UptimeAlert;

// TODO: This is a placeholder type for now
// Assume this is a timestamp of when the anomaly occurred and for how long
export type Anomaly = {
  anomaly: {[key: string]: number | string};
  timestamp: string;
  value: number;
};

export const AnomalyType = {
  high: 'anomaly_higher_confidence',
  low: 'anomaly_lower_confidence',
  none: 'none',
  noData: 'no_data',
};
