import React, {createContext, useContext} from 'react';

import {RELATIVE_DAYS_WINDOW} from 'sentry/components/events/eventStatisticalDetector/consts';
import type {Event, Project} from 'sentry/types';
import {EventsResults} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import type {UseQueryResult} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';

const TransactionsDeltaProviderContext = createContext<UseQueryResult<
  EventsResults<string>,
  RequestError
> | null>(null);

const TRANSACTIONS_LIMIT = 10;

export function useTransactionsDelta(): UseQueryResult<
  EventsResults<string>,
  RequestError
> {
  const ctx = useContext(TransactionsDeltaProviderContext);
  if (!ctx) {
    throw new Error(
      'useTransactionsDelta called outside of TransactionsDeltaProviderProvider'
    );
  }
  return ctx;
}

interface TransactionsDeltaProviderProps {
  children: React.ReactNode;
  event: Event;
  project: Project;
}

export function TransactionsDeltaProvider(props: TransactionsDeltaProviderProps) {
  const evidenceData = props.event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const regressionScore = `regression_score(function.duration, 0.95, ${breakpoint})`;
  const percentileBefore = `percentile_before(function.duration, 0.95, ${breakpoint})`;
  const percentileAfter = `percentile_after(function.duration, 0.95, ${breakpoint})`;
  const throughputBefore = `cpm_before(${breakpoint})`;
  const throughputAfter = `cpm_after(${breakpoint})`;

  const transactionsDeltaQuery = useProfileFunctions({
    datetime,
    fields: [
      'transaction',
      percentileBefore,
      percentileAfter,
      throughputBefore,
      throughputAfter,
      regressionScore,
    ],
    sort: {
      key: regressionScore,
      order: 'desc',
    },
    query: `fingerprint:${fingerprint} ${regressionScore}:>0`,
    projects: [props.project.id],
    limit: TRANSACTIONS_LIMIT,
    referrer: 'api.profiling.functions.regression.transactions',
  });

  return (
    <TransactionsDeltaProviderContext.Provider value={transactionsDeltaQuery}>
      {props.children}
    </TransactionsDeltaProviderContext.Provider>
  );
}
