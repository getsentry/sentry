import {useContext} from 'react';

import {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
} from 'sentry/types';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';

import {ErrorsAndTransactionsConfig} from '../datasetConfig/errorsAndTransactions';
import {DashboardFilters, Widget} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';
import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

export function getIsMetricsDataFromSeriesResponse(
  result: SeriesResult
): boolean | undefined {
  const multiIsMetricsData = Object.values(result)
    .map(({isMetricsData}) => isMetricsData)
    // One non-metrics series will cause all of them to be marked as such
    .reduce((acc, value) => (acc === false ? false : value), undefined);

  return isMultiSeriesStats(result) ? multiIsMetricsData : result.isMetricsData;
}

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetched?: (results: OnDataFetchedProps) => void;
};

function WidgetQueries({
  api,
  children,
  organization,
  selection,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
}: Props) {
  const config = ErrorsAndTransactionsConfig;
  const context = useContext(DashboardsMEPContext);

  let setIsMetricsData: undefined | ((value?: boolean) => void);

  if (context) {
    setIsMetricsData = context.setIsMetricsData;
  }

  const isSeriesMetricsDataResults: boolean[] = [];
  const afterFetchSeriesData = (rawResults: SeriesResult) => {
    if (rawResults.data) {
      rawResults = rawResults as EventsStats;
      if (rawResults.isMetricsData !== undefined) {
        isSeriesMetricsDataResults.push(rawResults.isMetricsData);
      }
    } else {
      Object.keys(rawResults).forEach(key => {
        const rawResult: EventsStats = rawResults[key];
        if (rawResult.isMetricsData !== undefined) {
          isSeriesMetricsDataResults.push(rawResult.isMetricsData);
        }
      });
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isSeriesMetricsDataResults.includes(false));
  };

  const isTableMetricsDataResults: boolean[] = [];
  const afterFetchTableData = (rawResults: TableResult) => {
    if (rawResults.meta?.isMetricsData !== undefined) {
      isTableMetricsDataResults.push(rawResults.meta.isMetricsData);
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isTableMetricsDataResults.includes(false));
  };

  return (
    <GenericWidgetQueries<SeriesResult, TableResult>
      config={config}
      api={api}
      organization={organization}
      selection={selection}
      widget={widget}
      cursor={cursor}
      limit={limit}
      dashboardFilters={dashboardFilters}
      onDataFetched={onDataFetched}
      afterFetchSeriesData={afterFetchSeriesData}
      afterFetchTableData={afterFetchTableData}
    >
      {children}
    </GenericWidgetQueries>
  );
}

export default WidgetQueries;
