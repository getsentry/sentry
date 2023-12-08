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
 * React context for whether transactions(s) have a replay assiciated or not.
 *
 * You can query & read from the context via `useReplayCountForTransactions()`.
 */
export function ReplayCountForTransactions({children}: Props) {
  const organization = useOrganization();

  return (
    <ReplayCountCache
      queryKeyGenProps={{
        dataSource: 'discover',
        fieldName: 'transaction',
        organization,
      }}
    >
      {children}
    </ReplayCountCache>
  );
}

/**
 * Query results for whether a Transaction has replays associated.
 */
export function useReplayCountForTransactions() {
  const {getOne, getMany, hasOne, hasMany} = useReplayCount();

  return {
    getReplayCountForTransaction: getOne,
    getReplayCountForTransactions: getMany,
    transactionHasReplay: hasOne,
    transactionsHaveReplay: hasMany,
  };
}
