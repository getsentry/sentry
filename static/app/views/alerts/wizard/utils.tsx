import type {Organization} from 'sentry/types/organization';
import {
  Dataset,
  EventTypes,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';

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
    trace_item_throughput: 'count(span.duration)',
    trace_item_duration: 'span.duration',
    trace_item_apdex: 'apdex',
    trace_item_failure_rate: 'failure_rate()',
    trace_item_lcp: 'measurements.lcp',
    trace_item_fid: 'measurements.fid',
    trace_item_cls: 'measurements.cls',
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
  eventTypes,
  organization,
}: Pick<WizardRuleTemplate, 'aggregate' | 'dataset'> & {
  eventTypes?: EventTypes[];
  organization?: Organization;
}): MetricAlertType {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const identifierForDataset = alertTypeIdentifiers[dataset];
  const matchingAlertTypeEntry = Object.entries(identifierForDataset).find(
    ([_alertType, identifier]) => identifier && aggregate.includes(identifier as string)
  );
  const alertType =
    matchingAlertTypeEntry && (matchingAlertTypeEntry[0] as MetricAlertType);

  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, eventTypes);
    if (
      organization &&
      hasLogAlerts(organization) &&
      traceItemType === TraceItemDataset.LOGS
    ) {
      return 'trace_item_logs';
    }
    if (organization && deprecateTransactionAlerts(organization)) {
      return alertType ?? 'eap_metrics';
    }
    return 'eap_metrics';
  }
  return alertType ? alertType : 'custom_transactions';
}

export function hasLogAlerts(organization: Organization): boolean {
  return organization.features.includes('ourlogs-alerts');
}

export function getTraceItemTypeForDatasetAndEventType(
  dataset: Dataset,
  eventTypes?: EventTypes[]
) {
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return eventTypes?.includes(EventTypes.TRACE_ITEM_LOG)
      ? TraceItemDataset.LOGS
      : TraceItemDataset.SPANS;
  }
  return null;
}
