import {useEffect, useMemo, type ReactNode} from 'react';

import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useInitialTimeOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLogReplayDataLoaded from 'sentry/utils/replays/hooks/useLogReplayDataLoaded';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerSizeContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayPlaylistProvider} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplaySummaryContextProvider} from 'sentry/views/replays/detail/ai/replaySummaryContext';
import {type ReplayListRecord} from 'sentry/views/replays/types';

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

  const query = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      environment: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      utc: decodeScalar,
      playlistStart: decodeScalar,
      playlistEnd: decodeScalar,
      playlistSort: decodeScalar,
      sort: decodeScalar,
    },
  });

  const newQuery = {...query};

  if (query.playlistStart && query.playlistEnd) {
    newQuery.start = query.playlistStart;
    newQuery.end = query.playlistEnd;
  }
  if (query.playlistSort) {
    newQuery.sort = query.playlistSort;
  }

  const queryKey = useReplayListQueryKey({
    options: {query: newQuery},
    organization,
    queryReferrer: 'replayList',
  });
  const {data} = useApiQuery<{
    data: ReplayListRecord[];
    enabled: true;
  }>(queryKey, {staleTime: 0});

  const replays = useMemo(() => data?.data?.map(mapResponseToReplayRecord) ?? [], [data]);

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
