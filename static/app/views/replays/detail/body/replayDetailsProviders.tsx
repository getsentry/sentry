import {useEffect, useMemo, type ReactNode} from 'react';

import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {DEFAULT_REPLAY_LIST_SORT} from 'sentry/components/replays/table/useReplayTableSort';
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
import {
  type ReplayListQueryReferrer,
  type ReplayListRecord,
} from 'sentry/views/replays/types';

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

  const {playlistStart, playlistEnd, playlistSort, ...query} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      environment: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      playlistStart: decodeScalar,
      playlistEnd: decodeScalar,
      playlistSort: decodeScalar,
      sort: decodeScalar,
      referrer: decodeScalar,
    },
  });

  // We use the playlist prefix to make it clear that these URL params are used
  // for the playlist navigation, and to avoid confusion with the regular start and end params.
  if (playlistStart && playlistEnd) {
    query.start = playlistStart;
    query.end = playlistEnd;
  }
  query.sort =
    !playlistSort || playlistSort === '' ? DEFAULT_REPLAY_LIST_SORT : playlistSort;

  const queryKey = useReplayListQueryKey({
    options: {query},
    organization,
    queryReferrer: query.referrer
      ? (query.referrer as ReplayListQueryReferrer)
      : 'replayList',
  });
  const {data, isLoading} = useApiQuery<{
    data: ReplayListRecord[];
    enabled: boolean;
  }>(queryKey, {
    staleTime: 0,
    enabled: Boolean(playlistStart && playlistEnd),
  });

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
                  <ReplayPlaylistProvider
                    currentReplay={replayRecord}
                    isLoading={isLoading}
                    replays={replays}
                  >
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
