import {useEffect, useRef} from 'react';

import {useAiQueryRunId} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryRunIdContext';
import {trackAiQueryOutcome} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

type TrackedDataset = Parameters<typeof trackAiQueryOutcome>[0]['dataset'];

interface UseAiQueryAnalyticsOptions {
  dataset: TrackedDataset;
  rawCounts: RawCounts;
  referrer: string;
}

export function useAiQueryAnalytics({
  dataset,
  referrer,
  rawCounts,
}: UseAiQueryAnalyticsOptions) {
  const {runId} = useAiQueryRunId();
  const organization = useOrganization();
  const prevRunIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (rawCounts.total.count === null) {
      return;
    }
    if (runId === null || runId === prevRunIdRef.current) {
      return;
    }
    prevRunIdRef.current = runId;
    trackAiQueryOutcome({
      dataset,
      referrer,
      resultCount: rawCounts.total.count,
      orgSlug: organization.slug,
      runId,
    });
  }, [runId, rawCounts.total.count, dataset, referrer, organization.slug]);
}
