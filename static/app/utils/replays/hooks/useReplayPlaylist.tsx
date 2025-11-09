import {useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {ReplayListRecord, ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  organization: Organization;
}

export default function useReplayPlaylist({organization}: Props): ReplayRecord[] {
  const {playlistStart, playlistEnd, ...query} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      environment: decodeList,
      playlistEnd: decodeScalar,
      playlistStart: decodeScalar,
      project: decodeList,
      query: decodeScalar,
      sort: decodeScalar,
      start: decodeScalar,
      utc: decodeScalar,
    },
  });

  if (playlistStart !== '' && playlistEnd !== '') {
    query.start = playlistStart;
    query.end = playlistEnd;
  }

  const queryKey = useReplayListQueryKey({
    options: {query},
    organization,
    queryReferrer: 'playlist',
  });
  const {data} = useApiQuery<{
    data: ReplayListRecord[];
  }>(queryKey, {
    staleTime: 0,
    enabled: Boolean(query.start && query.end && query.sort),
  });

  const replays = useMemo(() => data?.data?.map(mapResponseToReplayRecord) ?? [], [data]);

  return replays;
}
