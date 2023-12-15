import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export default function useReplayExists() {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 100,
    dataSource: 'discover',
    fieldName: 'replay_id',
    organization,
    statsPeriod: '90d',
  });

  return {
    replayExists: hasOne,
    replaysExist: hasMany,
  };
}
