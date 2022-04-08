import {Dataset, SessionsAggregate} from 'sentry/views/alerts/incidentRules/types';

import {AlertType, WizardRuleTemplate} from './options';

// A set of unique identifiers to be able to tie aggregate and dataset back to a wizard alert type
const alertTypeIdentifiers: Record<Dataset, Partial<Record<AlertType, string>>> = {
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
  [Dataset.SESSIONS]: {
    crash_free_sessions: SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: SessionsAggregate.CRASH_FREE_USERS,
  },
  [Dataset.METRICS]: {
    crash_free_sessions: SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: SessionsAggregate.CRASH_FREE_USERS,
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
}: Pick<WizardRuleTemplate, 'aggregate' | 'dataset'>): AlertType {
  const identifierForDataset = alertTypeIdentifiers[dataset];
  const matchingAlertTypeEntry = Object.entries(identifierForDataset).find(
    ([_alertType, identifier]) => identifier && aggregate.includes(identifier)
  );
  const alertType = matchingAlertTypeEntry && (matchingAlertTypeEntry[0] as AlertType);
  return alertType ? alertType : 'custom';
}
