import {useContext} from 'react';
import omit from 'lodash/omit';

import {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import {ErrorsAndTransactionsConfig} from '../datasetConfig/errorsAndTransactions';
import {DashboardFilters, Widget} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';
import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type SeriesWithOrdering = [order: number, series: Series];

export function transformSeries(
  stats: EventsStats,
  seriesName: string,
  field: string
): Series {
  const unit = stats.meta?.units?.[getAggregateAlias(field)];
  // Scale series values to milliseconds or bytes depending on units from meta
  const scale = (unit && (DURATION_UNITS[unit] ?? SIZE_UNITS[unit])) ?? 1;
  return {
    seriesName,
    data:
      stats?.data?.map(([timestamp, counts]) => {
        return {
          name: timestamp * 1000,
          value: counts.reduce((acc, {count}) => acc + count, 0) * scale,
        };
      }) ?? [],
  };
}

/**
 * Multiseries data with a grouping needs to be "flattened" because the aggregate data
 * are stored under the group names. These names need to be combined with the aggregate
 * names to show a series.
 *
 * e.g. count() and count_unique() grouped by environment
 * {
 *    "local": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    },
 *    "prod": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    }
 * }
 */
export function flattenMultiSeriesDataWithGrouping(
  result: SeriesResult,
  queryAlias: string
): SeriesWithOrdering[] {
  const seriesWithOrdering: SeriesWithOrdering[] = [];
  const groupNames = Object.keys(result);

  groupNames.forEach(groupName => {
    // Each group contains an order key which we should ignore
    const aggregateNames = Object.keys(omit(result[groupName], 'order'));

    aggregateNames.forEach(aggregate => {
      const seriesName = `${groupName} : ${aggregate}`;
      const prefixedName = queryAlias ? `${queryAlias} > ${seriesName}` : seriesName;
      const seriesData: EventsStats = result[groupName][aggregate];

      seriesWithOrdering.push([
        result[groupName].order || 0,
        transformSeries(seriesData, prefixedName, seriesName),
      ]);
    });
  });

  return seriesWithOrdering;
}

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

const WidgetQueries = ({
  api,
  children,
  organization,
  selection,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
}: Props) => {
  const config = ErrorsAndTransactionsConfig;
  const context = useContext(DashboardsMEPContext);
  const mepSettingContext = useMEPSettingContext();

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
      mepSetting={mepSettingContext.metricSettingState}
    >
      {children}
    </GenericWidgetQueries>
  );
};

export default WidgetQueries;
