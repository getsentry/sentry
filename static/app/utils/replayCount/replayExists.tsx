import {ReactNode} from 'react';

import {
  ReplayCountCache,
  useReplayCount,
} from 'sentry/utils/replayCount/replayCountCache';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: ReactNode;
}

/**
 * React context for whether replay(s) exist or not.
 *
 * You can query & read from the context via `useReplayExists()`.
 */
export function ReplayExists({children}: Props) {
  const organization = useOrganization();

  return (
    <ReplayCountCache
      queryKeyGenProps={{
        dataSource: 'discover',
        fieldName: 'replay_id',
        organization,
      }}
    >
      {children}
    </ReplayCountCache>
  );
}

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export function useReplayExists() {
  const {hasOne, hasMany} = useReplayCount();

  return {
    replayExists: hasOne,
    replaysExist: hasMany,
  };
}
