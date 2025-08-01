import {createContext} from 'react';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useFetchReplaySummary,
  type UseFetchReplaySummaryResult,
} from 'sentry/views/replays/detail/ai/useFetchReplaySummary';

export const ReplaySummaryContext = createContext<UseFetchReplaySummaryResult>({
  summaryData: undefined,
  isError: false,
  isPending: false,
  isPolling: false,
  startSummaryRequest: () => {},
  isStartSummaryRequestPending: false,
});

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

  return (
    <ReplaySummaryContext.Provider value={summaryResult}>
      {children}
    </ReplaySummaryContext.Provider>
  );
}
