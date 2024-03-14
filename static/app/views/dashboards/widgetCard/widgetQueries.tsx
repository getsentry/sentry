import {useContext} from 'react';
import omit from 'lodash/omit';

import type {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {MetricsResultsMetaMapKey} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMetricsResultsMeta} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlConsumer} from 'sentry/utils/performance/contexts/onDemandControl';

import {ErrorsAndTransactionsConfig} from '../datasetConfig/errorsAndTransactions';
import type {DashboardFilters, Widget} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';
import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

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
    const aggregateNames = Object.keys(
      omit(result[groupName], ['order', 'isMetricsExtractedData'])
    );

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
  const metricsMeta = useMetricsResultsMeta();
  const mepSettingContext = useMEPSettingContext();

  let setIsMetricsData: undefined | ((value?: boolean) => void);
  let setIsMetricsExtractedData:
    | undefined
    | ((mapKey: MetricsResultsMetaMapKey, value?: boolean) => void);

  if (context) {
    setIsMetricsData = context.setIsMetricsData;
  }
  if (metricsMeta) {
    setIsMetricsExtractedData = metricsMeta.setIsMetricsExtractedData;
  }

  const isSeriesMetricsDataResults: boolean[] = [];
  const isSeriesMetricsExtractedDataResults: (boolean | undefined)[] = [];
  const afterFetchSeriesData = (rawResults: SeriesResult) => {
    if (rawResults.data) {
      rawResults = rawResults as EventsStats;
      if (rawResults.isMetricsData !== undefined) {
        isSeriesMetricsDataResults.push(rawResults.isMetricsData);
      }
      if (rawResults.isMetricsExtractedData !== undefined) {
        isSeriesMetricsExtractedDataResults.push(rawResults.isMetricsExtractedData);
      }
      isSeriesMetricsExtractedDataResults.push(
        rawResults.isMetricsExtractedData || rawResults.meta?.isMetricsExtractedData
      );
    } else {
      Object.keys(rawResults).forEach(key => {
        const rawResult: EventsStats = rawResults[key];
        if (rawResult.isMetricsData !== undefined) {
          isSeriesMetricsDataResults.push(rawResult.isMetricsData);
        }
        if (
          (rawResult.isMetricsExtractedData || rawResult.meta?.isMetricsExtractedData) !==
          undefined
        ) {
          isSeriesMetricsExtractedDataResults.push(
            rawResult.isMetricsExtractedData || rawResult.meta?.isMetricsExtractedData
          );
        }
      });
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isSeriesMetricsDataResults.includes(false));
    setIsMetricsExtractedData?.(
      widget,
      isSeriesMetricsExtractedDataResults.every(Boolean) &&
        isSeriesMetricsExtractedDataResults.some(Boolean)
    );
  };

  const isTableMetricsDataResults: boolean[] = [];
  const isTableMetricsExtractedDataResults: boolean[] = [];
  const afterFetchTableData = (rawResults: TableResult) => {
    if (rawResults.meta?.isMetricsData !== undefined) {
      isTableMetricsDataResults.push(rawResults.meta.isMetricsData);
    }
    if (rawResults.meta?.isMetricsExtractedData !== undefined) {
      isTableMetricsExtractedDataResults.push(rawResults.meta.isMetricsExtractedData);
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isTableMetricsDataResults.includes(false));
    setIsMetricsExtractedData?.(
      widget,
      isTableMetricsExtractedDataResults.every(Boolean) &&
        isTableMetricsExtractedDataResults.some(Boolean)
    );
  };

  return (
    <OnDemandControlConsumer>
      {OnDemandControlContext => (
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
          onDemandControlContext={OnDemandControlContext}
          {...OnDemandControlContext}
        >
          {children}
        </GenericWidgetQueries>
      )}
    </OnDemandControlConsumer>
  );
}

export default WidgetQueries;
