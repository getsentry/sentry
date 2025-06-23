import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {type ReplayListRecord} from 'sentry/views/replays/types';

type Options = {
  queryKey: ApiQueryKey;
};

export default function useFetchReplayList({queryKey}: Options) {
  const {data, ...result} = useApiQuery<{data: any[]}>(queryKey, {
    staleTime: 0,
    enabled: true,
  });

  return {
    data: data?.data?.map<ReplayListRecord>(mapResponseToReplayRecord),
    ...result,
  };
}
