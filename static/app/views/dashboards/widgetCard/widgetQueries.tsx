import omit from 'lodash/omit';

import type {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {MetricsResultsMetaMapKey} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMetricsResultsMeta} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlConsumer} from 'sentry/utils/performance/contexts/onDemandControl';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';

import {type DashboardFilters, type Widget, WidgetType} from '../types';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      omit(result[groupName], ['order', 'isMetricsExtractedData'])
    );

    aggregateNames.forEach(aggregate => {
      const seriesName = `${groupName} : ${aggregate}`;
      const prefixedName = queryAlias ? `${queryAlias} > ${seriesName}` : seriesName;
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const seriesData: EventsStats = result[groupName][aggregate];

      seriesWithOrdering.push([
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
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
  onWidgetSplitDecision,
}: Props) {
  // Discover and Errors datasets are the only datasets processed in this component
  const config = getDatasetConfig(
    widget.widgetType as WidgetType.DISCOVER | WidgetType.ERRORS | WidgetType.TRANSACTIONS
  );
  const context = useDashboardsMEPContext();
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
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

    const resultValues = Object.values(rawResults);
    if (organization.features.includes('performance-discover-dataset-selector')) {
      let splitDecision: WidgetType | undefined = undefined;
      if (rawResults.meta) {
        splitDecision = (rawResults.meta as EventsStats['meta'])?.discoverSplitDecision;
      } else if (Object.values(rawResults).length > 0) {
        // Multi-series queries will have a meta key on each series
        // We can just read the decision from one.
        splitDecision = resultValues[0]?.meta?.discoverSplitDecision;
      }

      if (splitDecision) {
        // Update the dashboard state with the split decision
        onWidgetSplitDecision?.(splitDecision);
      }
    }
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

    if (
      organization.features.includes('performance-discover-dataset-selector') &&
      [WidgetType.ERRORS, WidgetType.TRANSACTIONS].includes(
        rawResults?.meta?.discoverSplitDecision
      )
    ) {
      // Update the dashboard state with the split decision
      onWidgetSplitDecision?.(rawResults?.meta?.discoverSplitDecision);
    }
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
