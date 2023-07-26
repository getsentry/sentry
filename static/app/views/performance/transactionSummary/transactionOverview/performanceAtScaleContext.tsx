import {createContext, useEffect, useState} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useMEPDataContext} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import useOrganization from 'sentry/utils/useOrganization';

type TransactionListTableData =
  | {
      empty: boolean;
      query: string;
    }
  | undefined;

export type PerformanceAtScaleContextProps = {
  metricsSeriesDataEmpty: boolean | undefined;
  setMetricsSeriesDataEmpty: (data: boolean | undefined) => void;
  setTransactionListTableData: (data: TransactionListTableData) => void;
  transactionListTableData: TransactionListTableData;
};

export const PerformanceAtScaleContext = createContext<
  PerformanceAtScaleContextProps | undefined
>(undefined);

type ProviderProps = {
  children: React.ReactNode;
};

export function PerformanceAtScaleContextProvider({children}: ProviderProps) {
  const [metricsSeriesDataEmpty, setMetricsSeriesDataEmpty] = useState<
    boolean | undefined
  >(false);

  const [transactionListTableData, setTransactionListTableData] =
    useState<TransactionListTableData>(undefined);

  const mepContext = useMEPDataContext();
  const organization = useOrganization();

  const query = transactionListTableData?.query ?? '';
  const transactionListTableEmpty = transactionListTableData?.empty;
  const isMetricsData = mepContext?.isMetricsData ?? false;

  useEffect(() => {
    // We only want to collect analytics events if we have metrics data
    // and if everything is dynamically samples
    if (!isMetricsData || !organization.isDynamicallySampled) {
      return;
    }

    // if the chart or the transaction list table are undefined,
    // some loading is probably still hapenning
    if (metricsSeriesDataEmpty === undefined || transactionListTableEmpty === undefined) {
      return;
    }

    // metricsSeriesDataEmpty comes from the series data response (events-stats request)
    // and if we don't have metrics data, we don't want to fire analytics events
    if (metricsSeriesDataEmpty) {
      return;
    }

    // If the transaction list table is empty, we want to fire the no_samples event
    // as it means that there is a gap in the dynamic sampling and we want to track that
    if (transactionListTableEmpty) {
      trackAnalytics('dynamic_sampling_transaction_summary.no_samples', {
        organization,
        query,
      });
    }

    // If the transaction list table is not empty and there are metrics, it means that
    // dynamic sampling is working properly and there is no gap
    trackAnalytics('dynamic_sampling_transaction_summary.baseline', {
      organization,
      query,
    });
  }, [
    metricsSeriesDataEmpty,
    isMetricsData,
    query,
    transactionListTableEmpty,
    organization,
  ]);

  return (
    <PerformanceAtScaleContext.Provider
      value={{
        metricsSeriesDataEmpty,
        setMetricsSeriesDataEmpty,
        setTransactionListTableData,
        transactionListTableData,
      }}
    >
      {children}
    </PerformanceAtScaleContext.Provider>
  );
}
