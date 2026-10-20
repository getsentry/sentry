import type {Theme} from '@emotion/react';

import {REASON_INFO} from 'sentry/components/droppedData/reasonInfo';
import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  [Outcome.CLIENT_DISCARD]: t('Client Discard'),
  [Outcome.FILTERED]: t('Inbound Filter'),
  [Outcome.INVALID]: t('Invalid or Malformed'),
  [Outcome.RATE_LIMITED]: t('Rate Limited'),
  [Outcome.ABUSE]: t('Abuse Limit'),
  [Outcome.CARDINALITY_LIMITED]: t('Cardinality Limit'),
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome as Outcome] ?? outcome;
}

function normalizeReason(reason: string): string {
  if (reason === 'ignored') {
    return 'ignore_spans';
  }
  if (REASON_INFO[reason]) {
    return reason;
  }
  // Reasons like `Sampled:0` or `custom-inbound-filter:foo` carry a dynamic
  // suffix; the registry keys on the bare prefix. Exact keys (`too_large:span`)
  // are matched above, so this only strips genuinely dynamic suffixes.
  const prefix = reason.slice(0, reason.indexOf(':'));
  if (reason.includes(':') && REASON_INFO[prefix]) {
    return prefix;
  }
  return reason.endsWith('_usage_exceeded') ? 'usage_exceeded' : reason;
}

export function reasonTitle(reason: string): string {
  return REASON_INFO[normalizeReason(reason)]?.title ?? reason;
}

export function buildTroubleshootPrompt(args: {
  dataset: DiscoverDatasets;
  outcome: string;
  reason: string;
}): string {
  return t(
    'My %s data is being dropped as "%s" (%s). Why is this happening and how do I fix it?',
    args.dataset,
    outcomeLabel(args.outcome),
    reasonTitle(args.reason)
  );
}

export type OutcomeColors = Record<string, string>;

export function getOutcomeColors(outcomes: string[], theme: Theme): OutcomeColors {
  const orderedOutcomes = [...new Set(outcomes)].sort();
  const palette = theme.chart.getColorPalette(Math.max(orderedOutcomes.length - 1, 0));

  return orderedOutcomes.reduce<OutcomeColors>((acc, outcome, index) => {
    acc[outcome] = palette[index % palette.length]!;
    return acc;
  }, {});
}

export type OutcomeSelection = Record<string, boolean>;

export function isOutcomeSelected(selection: OutcomeSelection, outcome: string): boolean {
  return selection[outcome] !== false;
}

// Shares run tiny (a reason can be a sliver of all traffic), so floor the
// display at 0.01% rather than rounding to 0%. Matches the drop tooltip.
const SHARE_MIN_VALUE = 0.0001;

export function formatDroppedShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}
