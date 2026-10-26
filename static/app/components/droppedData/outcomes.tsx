import {t, tn} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

interface TelemetryName {
  noun: (count: number) => string;
  title: string;
}

const TELEMETRY_NAMES: Partial<Record<DiscoverDatasets, TelemetryName>> = {
  errors: {title: t('Errors'), noun: count => tn('error', 'errors', count)},
  ourlogs: {title: t('Logs'), noun: count => tn('log', 'logs', count)},
  spans: {title: t('Spans'), noun: count => tn('span', 'spans', count)},
  tracemetrics: {title: t('Metrics'), noun: count => tn('metric', 'metrics', count)},
};

const DEFAULT_TELEMETRY_NAME: TelemetryName = {
  title: t('Events'),
  noun: count => tn('event', 'events', count),
};

function telemetryName(dataset: DiscoverDatasets): TelemetryName {
  return TELEMETRY_NAMES[dataset] ?? DEFAULT_TELEMETRY_NAME;
}

export function droppedDataLabel(dataset: DiscoverDatasets): string {
  return t('Dropped %s', telemetryName(dataset).title);
}

export function droppedAndFilteredLabel(dataset: DiscoverDatasets): string {
  return t('Dropped and Filtered %s', telemetryName(dataset).title);
}

export function datasetNoun(dataset: DiscoverDatasets, count: number): string {
  return telemetryName(dataset).noun(count);
}

const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  [Outcome.CLIENT_DISCARD]: t('Client Discard'),
  [Outcome.FILTERED]: t('Inbound Filters'),
  [Outcome.INVALID]: t('Invalid or Malformed'),
  [Outcome.RATE_LIMITED]: t('Rate Limited'),
  [Outcome.ABUSE]: t('Abuse Limit'),
  [Outcome.CARDINALITY_LIMITED]: t('Cardinality Limit'),
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome as Outcome] ?? outcome;
}

// Shares run tiny (a reason can be a sliver of all traffic), so floor the
// display at 0.01% rather than rounding to 0%. Matches the drop tooltip.
const SHARE_MIN_VALUE = 0.0001;

export function formatDroppedShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}
