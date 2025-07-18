import {type ReactNode, useEffect} from 'react';

import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import useInitialTimeOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLogReplayDataLoaded from 'sentry/utils/replays/hooks/useLogReplayDataLoaded';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerSizeContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchReplaySummary} from 'sentry/views/replays/detail/ai/useFetchReplaySummary';
import ReplayTransactionContext from 'sentry/views/replays/detail/trace/replayTransactionContext';

interface Props {
  children: ReactNode;
  projectSlug: string | null;
  replay: ReplayReader;
}

export default function ReplayDetailsProviders({children, replay, projectSlug}: Props) {
  const organization = useOrganization();

  const replayRecord = replay.getReplay();
  const initialTimeOffsetMs = useInitialTimeOffsetMs({
    orgSlug: organization.slug,
    projectSlug,
    replayId: replayRecord.id,
    replayStartTimestampMs: replayRecord.started_at?.getTime(),
  });

  const {mutate: markAsViewed} = useMarkReplayViewed();
  useEffect(() => {
    if (projectSlug && replayRecord.id && !replayRecord.has_viewed) {
      markAsViewed({projectSlug, replayId: replayRecord.id});
    }
  }, [markAsViewed, organization, projectSlug, replayRecord]);

  useLogReplayDataLoaded({projectId: replayRecord.project_id, replay});

  const replaySummaryQueryResult = useFetchReplaySummary({
    staleTime: 0,
    enabled: Boolean(
      replayRecord?.id &&
        projectSlug &&
        organization.features.includes('replay-ai-summaries') &&
        organization.features.includes('gen-ai-features')
    ),
    retry: false,
  });

  return (
    <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
      <ReplayPlayerPluginsContextProvider>
        <ReplayReaderProvider replay={replay}>
          <ReplayPlayerStateContextProvider>
            <ReplayPlayerSizeContextProvider>
              <ReplayContextProvider
                analyticsContext="replay_details"
                initialTimeOffsetMs={initialTimeOffsetMs}
                isFetching={false}
                replay={replay}
                replaySummaryQueryResult={replaySummaryQueryResult}
              >
                <ReplayTransactionContext replayRecord={replayRecord}>
                  {children}
                </ReplayTransactionContext>
              </ReplayContextProvider>
            </ReplayPlayerSizeContextProvider>
          </ReplayPlayerStateContextProvider>
        </ReplayReaderProvider>
      </ReplayPlayerPluginsContextProvider>
    </ReplayPreferencesContextProvider>
  );
}
