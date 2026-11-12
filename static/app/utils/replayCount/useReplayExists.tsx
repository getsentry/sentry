import {useMemo} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';

import {useReplayCount} from './useReplayCount';

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export function useReplayExists({start, end}: {end?: string; start?: string} = {}) {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 100,
    // The dataSource doesn't matter here - queries on `replay_id` skip the
    // given dataSource and go straight to `replays`.
    dataSource: 'events',
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
