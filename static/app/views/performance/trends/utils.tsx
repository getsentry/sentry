import {ASAP} from 'downsample/methods/ASAP';
import {Location} from 'history';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {
  AggregationKey,
  Field,
  generateFieldAsString,
  Sort,
} from 'sentry/utils/discover/fields';
import {TransactionMetric} from 'sentry/utils/metrics/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import theme from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {platformToPerformanceType, PROJECT_PERFORMANCE_TYPE} from '../utils';

import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendColumnField,
  TrendFunction,
  TrendFunctionField,
  TrendParameter,
  TrendsTransaction,
  TrendView,
} from './types';

export const trendParameterToMetricsField: Record<string, TransactionMetric> = {
  [TrendColumnField.DURATION]: TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION,
  [TrendColumnField.LCP]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP,
  [TrendColumnField.FCP]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP,
  [TrendColumnField.FID]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID,
  [TrendColumnField.CLS]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS,
};

export const DEFAULT_TRENDS_STATS_PERIOD = '14d';
export const DEFAULT_MAX_DURATION = '15min';

export const TRENDS_FUNCTIONS: TrendFunction[] = [
  {
    label: 'p50',
    field: TrendFunctionField.P50,
    alias: 'percentile_range',
    legendLabel: 'p50',
  },
  {
    label: 'p75',
    field: TrendFunctionField.P75,
    alias: 'percentile_range',
    legendLabel: 'p75',
  },
  {
    label: 'p95',
    field: TrendFunctionField.P95,
    alias: 'percentile_range',
    legendLabel: 'p95',
  },
  {
    label: 'p99',
    field: TrendFunctionField.P99,
    alias: 'percentile_range',
    legendLabel: 'p99',
  },
  {
    label: 'average',
    field: TrendFunctionField.AVG,
    alias: 'avg_range',
    legendLabel: 'average',
  },
];

export const TRENDS_PARAMETERS: TrendParameter[] = [
  {
    label: 'Duration',
    column: TrendColumnField.DURATION,
  },
  {
    label: 'LCP',
    column: TrendColumnField.LCP,
  },
  {
    label: 'FCP',
    column: TrendColumnField.FCP,
  },
  {
    label: 'FID',
    column: TrendColumnField.FID,
  },
  {
    label: 'CLS',
    column: TrendColumnField.CLS,
  },
  {
    label: 'Spans (http)',
    column: TrendColumnField.SPANS_HTTP,
  },
  {
    label: 'Spans (db)',
    column: TrendColumnField.SPANS_DB,
  },
  {
    label: 'Spans (browser)',
    column: TrendColumnField.SPANS_BROWSER,
  },
  {
    label: 'Spans (resource)',
    column: TrendColumnField.SPANS_RESOURCE,
  },
];

export const trendToColor = {
  [TrendChangeType.IMPROVED]: {
    lighter: theme.green200,
    default: theme.green300,
  },
  [TrendChangeType.REGRESSION]: {
    lighter: theme.red200,
    default: theme.red300,
  },
};

export const trendSelectedQueryKeys = {
  [TrendChangeType.IMPROVED]: 'improvedSelected',
  [TrendChangeType.REGRESSION]: 'regressionSelected',
};

export const trendUnselectedSeries = {
  [TrendChangeType.IMPROVED]: 'improvedUnselectedSeries',
  [TrendChangeType.REGRESSION]: 'regressionUnselectedSeries',
};

export const trendCursorNames = {
  [TrendChangeType.IMPROVED]: 'improvedCursor',
  [TrendChangeType.REGRESSION]: 'regressionCursor',
};

export function resetCursors() {
  const cursors = {};
  Object.values(trendCursorNames).forEach(cursor => (cursors[cursor] = undefined)); // Resets both cursors
  return cursors;
}

export function getCurrentTrendFunction(
  location: Location,
  _trendFunctionField?: TrendFunctionField
): TrendFunction {
  const trendFunctionField =
    _trendFunctionField ?? decodeScalar(location?.query?.trendFunction);
  const trendFunction = TRENDS_FUNCTIONS.find(({field}) => field === trendFunctionField);
  return trendFunction || TRENDS_FUNCTIONS[0];
}

function getDefaultTrendParameter(
  projects: Project[],
  projectIds: Readonly<number[]>
): TrendParameter {
  const performanceType = platformToPerformanceType(projects, projectIds);
  const trendParameter = performanceTypeToTrendParameterLabel(performanceType);

  return trendParameter;
}

export function getCurrentTrendParameter(
  location: Location,
  projects: Project[],
  projectIds: Readonly<number[]>
): TrendParameter {
  const trendParameterLabel = decodeScalar(location?.query?.trendParameter);
  const trendParameter = TRENDS_PARAMETERS.find(
    ({label}) => label === trendParameterLabel
  );

  if (trendParameter) {
    return trendParameter;
  }

  const defaultTrendParameter = getDefaultTrendParameter(projects, projectIds);
  return defaultTrendParameter;
}

export function performanceTypeToTrendParameterLabel(
  performanceType: PROJECT_PERFORMANCE_TYPE
): TrendParameter {
  switch (performanceType) {
    case PROJECT_PERFORMANCE_TYPE.FRONTEND:
      return {
        label: 'LCP',
        column: TrendColumnField.LCP,
      };
    case PROJECT_PERFORMANCE_TYPE.ANY:
    case PROJECT_PERFORMANCE_TYPE.BACKEND:
    case PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER:
    default:
      return {
        label: 'Duration',
        column: TrendColumnField.DURATION,
      };
  }
}

export function generateTrendFunctionAsString(
  trendFunction: TrendFunctionField,
  trendParameter: string
): string {
  return generateFieldAsString({
    kind: 'function',
    function: [trendFunction as AggregationKey, trendParameter, undefined, undefined],
  });
}

export function transformDeltaSpread(from: number, to: number) {
  const fromSeconds = from / 1000;
  const toSeconds = to / 1000;

  const showDigits = from > 1000 || to > 1000 || from < 10 || to < 10; // Show digits consistently if either has them

  return {fromSeconds, toSeconds, showDigits};
}

export function getTrendProjectId(
  trend: NormalizedTrendsTransaction,
  projects?: Project[]
): string | undefined {
  if (!trend.project || !projects) {
    return undefined;
  }
  const transactionProject = projects.find(project => project.slug === trend.project);
  return transactionProject?.id;
}

export function modifyTrendView(
  trendView: TrendView,
  location: Location,
  trendsType: TrendChangeType,
  projects: Project[],
  isProjectOnly?: boolean
) {
  const trendFunction = getCurrentTrendFunction(location);
  const trendParameter = getCurrentTrendParameter(location, projects, trendView.project);

  const transactionField = isProjectOnly ? [] : ['transaction'];
  const fields = [...transactionField, 'project'].map(field => ({
    field,
  })) as Field[];

  const trendSort = {
    field: 'trend_percentage()',
    kind: 'asc',
  } as Sort;

  trendView.trendType = trendsType;
  if (trendsType === TrendChangeType.REGRESSION) {
    trendSort.kind = 'desc';
  }

  if (trendFunction && trendParameter) {
    trendView.trendFunction = generateTrendFunctionAsString(
      trendFunction.field,
      trendParameter.column
    );
  }
  trendView.query = getLimitTransactionItems(trendView.query);

  trendView.interval = getQueryInterval(location, trendView);

  trendView.sorts = [trendSort];
  trendView.fields = fields;
}

export function modifyTrendsViewDefaultPeriod(eventView: EventView, location: Location) {
  const {query} = location;

  const hasStartAndEnd = query.start && query.end;

  if (!query.statsPeriod && !hasStartAndEnd) {
    eventView.statsPeriod = DEFAULT_TRENDS_STATS_PERIOD;
  }
  return eventView;
}

function getQueryInterval(location: Location, eventView: TrendView) {
  const intervalFromQueryParam = decodeScalar(location?.query?.interval);
  const {start, end, statsPeriod} = eventView;

  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod,
  };

  const intervalFromSmoothing = getInterval(datetimeSelection, 'high');

  return intervalFromQueryParam || intervalFromSmoothing;
}

export function transformValueDelta(value: number, trendType: TrendChangeType) {
  const absoluteValue = Math.abs(value);

  const changeLabel =
    trendType === TrendChangeType.REGRESSION ? t('slower') : t('faster');

  const seconds = absoluteValue / 1000;

  const fixedDigits = absoluteValue > 1000 || absoluteValue < 10 ? 1 : 0;

  return {seconds, fixedDigits, changeLabel};
}

/**
 * This will normalize the trends transactions while the current trend function and current data are out of sync
 * To minimize extra renders with missing results.
 */
export function normalizeTrends(
  data: Array<TrendsTransaction>
): Array<NormalizedTrendsTransaction> {
  const received_at = moment(); // Adding the received time for the transaction so calls to get baseline always line up with the transaction
  return data.map(row => {
    return {
      ...row,
      received_at,
      transaction: row.transaction,
    } as NormalizedTrendsTransaction;
  });
}

export function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendSelectedQueryKeys[trendChangeType];
}

export function getUnselectedSeries(trendChangeType: TrendChangeType) {
  return trendUnselectedSeries[trendChangeType];
}

export function movingAverage(data, index, size) {
  return (
    data
      .slice(index - size, index)
      .map(a => a.value)
      .reduce((a, b) => a + b, 0) / size
  );
}

/**
 * This function applies defaults for trend and count percentage, and adds the confidence limit to the query
 */
function getLimitTransactionItems(query: string) {
  const limitQuery = new MutableSearch(query);
  if (!limitQuery.hasFilter('count_percentage()')) {
    limitQuery.addFilterValues('count_percentage()', ['>0.25', '<4']);
  }
  if (!limitQuery.hasFilter('trend_percentage()')) {
    limitQuery.addFilterValues('trend_percentage()', ['>0%']);
  }
  if (!limitQuery.hasFilter('confidence()')) {
    limitQuery.addFilterValues('confidence()', ['>6']);
  }
  return limitQuery.formatString();
}

export const smoothTrend = (data: [number, number][], resolution = 100) => {
  return ASAP(data, resolution);
};

export const replaceSeriesName = (seriesName: string) => {
  return ['p50', 'p75'].find(aggregate => seriesName.includes(aggregate));
};

export const replaceSmoothedSeriesName = (seriesName: string) => {
  return `Smoothed ${['p50', 'p75'].find(aggregate => seriesName.includes(aggregate))}`;
};

export function transformEventStatsSmoothed(data?: Series[], seriesName?: string) {
  let minValue = Number.MAX_SAFE_INTEGER;
  let maxValue = 0;
  if (!data) {
    return {
      maxValue,
      minValue,
      smoothedResults: undefined,
    };
  }

  const smoothedResults: Series[] = [];

  for (const current of data) {
    const currentData = current.data;
    const resultData: SeriesDataUnit[] = [];

    const smoothed = smoothTrend(
      currentData.map(({name, value}) => [Number(name), value])
    );

    for (let i = 0; i < smoothed.length; i++) {
      const point = smoothed[i] as any;
      const value = point.y;
      resultData.push({
        name: point.x,
        value,
      });
      if (!isNaN(value)) {
        const rounded = Math.round(value);
        minValue = Math.min(rounded, minValue);
        maxValue = Math.max(rounded, maxValue);
      }
    }
    smoothedResults.push({
      seriesName: seriesName || current.seriesName || 'Current',
      data: resultData,
      lineStyle: current.lineStyle,
      color: current.color,
    });
  }

  return {
    minValue,
    maxValue,
    smoothedResults,
  };
}
