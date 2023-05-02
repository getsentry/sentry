import {createContext, useContext, useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {PageFilters} from 'sentry/types';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import useOrganization from 'sentry/utils/useOrganization';

const TransactionProfileContext = createContext<string | null | undefined>(undefined);

interface TransactionToProfileIdProviderProps {
  children: React.ReactNode;
  timestamp: string | undefined;
  transactionId: string | undefined;
  projectId?: string | undefined;
}

export function TransactionProfileIdProvider({
  projectId,
  timestamp,
  transactionId,
  children,
}: TransactionToProfileIdProviderProps) {
  const organization = useOrganization();
  // create a 24h timeframe relative from the transaction timestamp to use for
  // the profile events query
  const datetime: PageFilters['datetime'] | undefined = useMemo(() => {
    if (!timestamp) {
      return undefined;
    }
    const ts = new Date(timestamp);
    const start = new Date(new Date(ts).setHours(ts.getHours() - 12));
    const end = new Date(new Date(ts).setHours(ts.getHours() + 12));

    return {
      start,
      end,
      period: null,
      utc: true,
    };
  }, [timestamp]);

  const profileIdColumn = organization.features.includes('profiling-using-transactions')
    ? 'profile.id'
    : 'id';

  const transactionIdColumn = organization.features.includes(
    'profiling-using-transactions'
  )
    ? 'id'
    : 'trace.transaction';

  const {status, data, error} = useProfileEvents({
    projects: projectId ? [projectId] : undefined,
    fields: [profileIdColumn],
    referrer: 'transactionToProfileProvider',
    limit: 1,
    sort: {
      key: 'id',
      order: 'asc',
    },
    query: `${transactionIdColumn}:${transactionId}`,
    enabled: Boolean(transactionId),
    datetime,
  });

  useEffect(() => {
    if (status !== 'error') {
      return;
    }

    if (error.status !== 404) {
      Sentry.captureException(error);
    }
  }, [status, error]);

  const profileId = (data?.data[0]?.[profileIdColumn] as string | undefined) ?? null;

  return (
    <TransactionProfileContext.Provider value={profileId}>
      {children}
    </TransactionProfileContext.Provider>
  );
}
TransactionProfileIdProvider.Context = TransactionProfileContext;

export function useTransactionProfileId() {
  const ctx = useContext(TransactionProfileContext);
  if (typeof ctx === 'undefined') {
    throw new Error(`useTransactionProfile called outside of TransactionProfileProvider`);
  }

  return ctx;
}
