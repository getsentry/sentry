import {useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import {useLocation} from 'sentry/utils/useLocation';
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
  statsPeriod,
}: Props = {}) {
  const organization = useOrganization();
  const location = useLocation();
  const {getOne, getMany, hasOne, hasMany} = useReplayCount({
    bufferLimit,
    dataSource: 'discover',
    fieldName: 'transaction',
    organization,
    statsPeriod: statsPeriod ?? decodeScalar(location.query.statsPeriod) ?? '90d',
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
