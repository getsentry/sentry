import {useEffect, useMemo, type ReactNode} from 'react';

import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import EventView from 'sentry/utils/discover/eventView';
import useInitialTimeOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLogReplayDataLoaded from 'sentry/utils/replays/hooks/useLogReplayDataLoaded';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerSizeContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayPlaylistProvider} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplaySummaryContextProvider} from 'sentry/views/replays/detail/ai/replaySummaryContext';

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

  const location = useLocation();

  const eventView = useMemo(() => {
    return EventView.fromLocation(location);
  }, [location]);

  const {replays} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'playlist',
  });

  useLogReplayDataLoaded({projectId: replayRecord.project_id, replay});

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
              >
                <ReplaySummaryContextProvider replay={replay} projectSlug={projectSlug}>
                  <ReplayPlaylistProvider replays={replays}>
                    {children}
                  </ReplayPlaylistProvider>
                </ReplaySummaryContextProvider>
              </ReplayContextProvider>
            </ReplayPlayerSizeContextProvider>
          </ReplayPlayerStateContextProvider>
        </ReplayReaderProvider>
      </ReplayPlayerPluginsContextProvider>
    </ReplayPreferencesContextProvider>
  );
}
