import {createContext, useContext} from 'react';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useEmitTimestampChanges from 'sentry/utils/replays/playback/hooks/useEmitTimestampChanges';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useFetchReplaySummary,
  type UseFetchReplaySummaryResult,
} from 'sentry/views/replays/detail/ai/useFetchReplaySummary';

const ReplaySummaryContext = createContext<UseFetchReplaySummaryResult>({
  summaryData: undefined,
  isError: false,
  isPending: false,
  isPolling: false,
  startSummaryRequest: () => {},
  isStartSummaryRequestPending: false,
});

export function useReplaySummaryContext() {
  return useContext(ReplaySummaryContext);
}

export function ReplaySummaryContextProvider({
  children,
  replay,
  projectSlug,
}: {
  children: React.ReactNode;
  projectSlug: string | null;
  replay: ReplayReader;
}) {
  const organization = useOrganization();
  const {areAiFeaturesAllowed, setupAcknowledgement} = useOrganizationSeerSetup();

  const summaryResult = useFetchReplaySummary(replay, {
    staleTime: 0,
    enabled: Boolean(
      replay.getReplay().id &&
        projectSlug &&
        organization.features.includes('replay-ai-summaries') &&
        areAiFeaturesAllowed &&
        setupAcknowledgement.orgHasAcknowledged
    ),
  });
  useEmitTimestampChanges();

  return (
    <ReplaySummaryContext.Provider value={summaryResult}>
      {children}
    </ReplaySummaryContext.Provider>
  );
}
