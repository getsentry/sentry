import {Dataset, SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';

import type {MetricAlertType, WizardRuleTemplate} from './options';

// A set of unique identifiers to be able to tie aggregate and dataset back to a wizard alert type
const alertTypeIdentifiers: Record<
  Exclude<Dataset, Dataset.ISSUE_PLATFORM | Dataset.REPLAYS>, // IssuePlatform (search_issues) is not used in alerts, so we can exclude it here
  Partial<Record<MetricAlertType, string>>
> = {
  [Dataset.ERRORS]: {
    num_errors: 'count()',
    users_experiencing_errors: 'count_unique(user)',
  },
  [Dataset.TRANSACTIONS]: {
    throughput: 'count()',
    trans_duration: 'transaction.duration',
    apdex: 'apdex',
    failure_rate: 'failure_rate()',
    lcp: 'measurements.lcp',
    fid: 'measurements.fid',
    cls: 'measurements.cls',
  },
  [Dataset.GENERIC_METRICS]: {
    throughput: 'count()',
    trans_duration: 'transaction.duration',
    apdex: 'apdex',
    failure_rate: 'failure_rate()',
    lcp: 'measurements.lcp',
    fid: 'measurements.fid',
    cls: 'measurements.cls',
  },
  [Dataset.SESSIONS]: {
    crash_free_sessions: SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: SessionsAggregate.CRASH_FREE_USERS,
  },
  [Dataset.METRICS]: {
    crash_free_sessions: SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: SessionsAggregate.CRASH_FREE_USERS,
  },
  [Dataset.EVENTS_ANALYTICS_PLATFORM]: {
    throughput: 'count(span.duration)',
  },
};

/**
 * Given an aggregate and dataset object, will return the corresponding wizard alert type
 * e.g. {aggregate: 'count()', dataset: 'events'} will yield 'num_errors'
 * @param template
 */
export function getAlertTypeFromAggregateDataset({
  aggregate,
  dataset,
}: Pick<WizardRuleTemplate, 'aggregate' | 'dataset'>): MetricAlertType {
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return 'eap_metrics';
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const identifierForDataset = alertTypeIdentifiers[dataset];
  const matchingAlertTypeEntry = Object.entries(identifierForDataset).find(
    ([_alertType, identifier]) => identifier && aggregate.includes(identifier as string)
  );
  const alertType =
    matchingAlertTypeEntry && (matchingAlertTypeEntry[0] as MetricAlertType);
  return alertType ? alertType : 'custom_transactions';
}
