import {createContext, useContext} from 'react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';
import type {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

export type TransactionSummaryContext = {
  eventView: EventView;
  organization: Organization;
  projectId: string;
  projects: Project[];
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  transactionName: string;
  // These are used to trigger a reload when the threshold/metric changes.
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

export const TransactionSummaryContext = createContext<TransactionSummaryContext | null>(
  null
);

export const useTransactionSummaryContext = (): TransactionSummaryContext => {
  const context = useContext(TransactionSummaryContext);
  if (!context) {
    throw new Error(
      'useTransactionSummaryContext must be used within a TransactionSummaryContext.Provider'
    );
  }
  return context;
};
