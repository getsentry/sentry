import {useMemo} from 'react';

import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  bufferLimit?: number;
  statsPeriod?: string;
}

/**
 * Query results for whether a Transaction has replays associated.
 */
export default function useReplayCountForTransactions({
  bufferLimit = 25,
  statsPeriod = '14d',
}: Props = {}) {
  const organization = useOrganization();
  const {getOne, getMany, hasOne, hasMany} = useReplayCount({
    bufferLimit,
    dataSource: 'discover',
    fieldName: 'transaction',
    organization,
    statsPeriod,
  });

  return useMemo(
    () => ({
      getReplayCountForTransaction: getOne,
      getReplayCountForTransactions: getMany,
      transactionHasReplay: hasOne,
      transactionsHaveReplay: hasMany,
    }),
    [getMany, getOne, hasMany, hasOne]
  );
}
