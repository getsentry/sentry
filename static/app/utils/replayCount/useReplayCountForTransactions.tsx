import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether a Transaction has replays associated.
 */
export default function useReplayCountForTransactions() {
  const organization = useOrganization();
  const {getOne, getMany, hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'discover',
    fieldName: 'transaction',
    organization,
    statsPeriod: '90d',
  });

  return {
    getReplayCountForTransaction: getOne,
    getReplayCountForTransactions: getMany,
    transactionHasReplay: hasOne,
    transactionsHaveReplay: hasMany,
  };
}
