import {outcomeLabel} from 'sentry/components/droppedData/outcomes';
import {reasonTitle} from 'sentry/components/droppedData/reasonInfo';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

// Customer-facing names for datasets, keyed by the raw DiscoverDatasets values
// (`ourlogs`, `tracemetrics`, …) which are internal and must never reach a user.
// Keyed by literal rather than the enum to keep this a type-only import.
const DATASET_LABELS: Partial<Record<DiscoverDatasets, string>> = {
  errors: t('error'),
  ourlogs: t('log'),
  spans: t('span'),
  tracemetrics: t('application metric'),
};

function datasetLabel(dataset: DiscoverDatasets): string {
  return DATASET_LABELS[dataset] ?? dataset;
}

export function buildAskSeerPrompt(args: {
  dataset: DiscoverDatasets;
  outcome: string;
  reason: string;
}): string {
  return t(
    'My %(dataset)s data is being dropped as "%(outcome)s" (%(reason)s). Why is this happening and how do I fix it?',
    {
      dataset: datasetLabel(args.dataset),
      outcome: outcomeLabel(args.outcome),
      reason: reasonTitle(args.reason),
    }
  );
}
