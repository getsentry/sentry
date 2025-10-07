import {useMemo} from 'react';

import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export default function useReplayExists({
  start,
  end,
}: {end?: string; start?: string} = {}) {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 100,
    dataSource: 'discover',
    fieldName: 'replay_id',
    organization,
    statsPeriod: '90d',
    start,
    end,
  });

  return useMemo(
    () => ({
      replayExists: hasOne,
      replaysExist: hasMany,
    }),
    [hasMany, hasOne]
  );
}
