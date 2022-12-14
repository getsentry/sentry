import {createContext, useContext, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';

const TransactionProfileContext = createContext<string | null | undefined>(undefined);

interface TransactionToProfileIdProviderProps {
  children: React.ReactNode;
  transactionId: string | undefined;
}

export function TransactionProfileIdProvider({
  transactionId,
  children,
}: TransactionToProfileIdProviderProps) {
  const {status, data, error} = useProfileEvents({
    fields: ['id'],
    referrer: 'transactionToProfileProvider',
    limit: 1,
    sort: {
      key: 'id',
      order: 'asc',
    },
    query: `trace.transaction:${transactionId}`,
    enabled: Boolean(transactionId),
  });

  useEffect(() => {
    if (status !== 'error') {
      return;
    }

    if (error.status !== 404) {
      Sentry.captureException(error);
    }
  }, [status, error]);

  const profileId = (data?.[0].data[0]?.id as string | undefined) ?? null;

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
