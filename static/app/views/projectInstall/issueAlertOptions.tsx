import {t} from 'sentry/locale';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {IssueAlertActionType, IssueAlertConditionType} from 'sentry/types/alerts';
import {Interval} from 'sentry/views/automations/components/actionFilters/constants';

enum MetricValues {
  ERRORS = 0,
  USERS = 1,
}

const DEFAULT_CUSTOM_ALERT_ACTION_INTERVAL_MINUTES = 24 * 60;
const HIGH_PRIORITY_ALERT_ACTION_INTERVAL_MINUTES = 0;

type ProjectCreationAlertConditionType =
  | IssueAlertConditionType.EVENT_FREQUENCY
  | IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY;

export enum RuleAction {
  DEFAULT_ALERT = 0,
  CUSTOMIZED_ALERTS = 1,
  CREATE_ALERT_LATER = 2,
}

function metricValueToConditionType(
  metricValue: MetricValues
): ProjectCreationAlertConditionType {
  switch (metricValue) {
    case MetricValues.ERRORS:
      return IssueAlertConditionType.EVENT_FREQUENCY;
    case MetricValues.USERS:
      return IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY;
    default:
      throw new RangeError(`Supplied metric value ${metricValue} is not handled`);
  }
}

export const METRIC_CHOICES = [
  {value: MetricValues.ERRORS, label: t('occurrences of')},
  {value: MetricValues.USERS, label: t('users affected by')},
];

export const DEFAULT_ISSUE_ALERT_OPTIONS_VALUES = {
  alertSetting: RuleAction.DEFAULT_ALERT,
  interval: Interval.FIVE_MINUTES,
  metric: MetricValues.ERRORS,
  threshold: '10',
};

type ProjectCreationAlertCondition = {
  id: ProjectCreationAlertConditionType;
  interval: string;
  value: string;
};

export type RequestDataFragment = Pick<IssueAlertRule, 'actions' | 'frequency'> & {
  conditions: ProjectCreationAlertCondition[];
  defaultRules: boolean;
  shouldCreateCustomRule: boolean;
  shouldCreateRule: boolean;
};

export interface AlertRuleOptions {
  alertSetting: RuleAction;
  interval: Interval;
  metric: MetricValues;
  threshold: string;
}

export function getRequestDataFragment({
  alertSetting = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.alertSetting,
  interval = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.interval,
  metric = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.metric,
  threshold = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.threshold,
}: Partial<AlertRuleOptions> = {}): RequestDataFragment {
  return {
    defaultRules: alertSetting === RuleAction.DEFAULT_ALERT,
    shouldCreateRule: alertSetting !== RuleAction.CREATE_ALERT_LATER,
    shouldCreateCustomRule: alertSetting === RuleAction.CUSTOMIZED_ALERTS,
    conditions:
      interval.length > 0 && threshold.length > 0
        ? [
            {
              interval,
              id: metricValueToConditionType(metric),
              value: threshold,
            },
          ]
        : [],
    actions: [
      {
        id: IssueAlertActionType.NOTIFY_EMAIL,
        targetType: 'IssueOwners',
        fallthroughType: 'ActiveMembers',
      },
    ],
    frequency:
      alertSetting === RuleAction.CUSTOMIZED_ALERTS
        ? DEFAULT_CUSTOM_ALERT_ACTION_INTERVAL_MINUTES
        : HIGH_PRIORITY_ALERT_ACTION_INTERVAL_MINUTES,
  };
}
