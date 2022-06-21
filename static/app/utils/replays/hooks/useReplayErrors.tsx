import {useMemo} from 'react';

import {ReplayError} from 'sentry/views/replays/types';

import useDiscoverQuery from './useDiscoveryQuery';

interface Params {
  replayId: string;
  ignoreCursor?: boolean;
}

/**
 * Fetches a list of errors that occurred in a replay
 */
export default function useReplayErrors({replayId, ...props}: Params) {
  const discoverQuery = useMemo(
    () => ({
      query: `replayId:${replayId} AND event.type:error`,
      fields: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],

      // environment and project shouldn't matter because having a replayId
      // assumes we have already filtered down to proper env/project
      environment: [],
      projects: [],
    }),
    [replayId]
  );

  return useDiscoverQuery<ReplayError>({discoverQuery, ...props});
}
