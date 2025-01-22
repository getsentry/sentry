import {ASAP} from 'downsample/methods/ASAP';
import type {Location} from 'history';
import moment from 'moment-timezone';

import {getInterval} from 'sentry/components/charts/utils';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';
import type {AggregationKeyWithAlias, Field, Sort} from 'sentry/utils/discover/fields';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import theme from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

import type {
  NormalizedTrendsTransaction,
  TrendFunction,
  TrendParameter,
  TrendsTransaction,
  TrendView,
} from '../types';
import {
  TrendChangeType,
  TrendFunctionField,
  TrendParameterColumn,
  TrendParameterLabel,
} from '../types';

export const DEFAULT_TRENDS_STATS_PERIOD = '14d';
export const DEFAULT_MAX_DURATION = '15min';

export const TRENDS_FUNCTIONS: TrendFunction[] = [
  {
    label: 'p99',
    field: TrendFunctionField.P99,
    alias: 'percentile_range',
    legendLabel: 'p99',
  },
  {
    label: 'p95',
    field: TrendFunctionField.P95,
    alias: 'percentile_range',
    legendLabel: 'p95',
  },
  {
    label: 'p75',
    field: TrendFunctionField.P75,
    alias: 'percentile_range',
    legendLabel: 'p75',
  },
  {
    label: 'p50',
    field: TrendFunctionField.P50,
    alias: 'percentile_range',
    legendLabel: 'p50',
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
    label: TrendParameterLabel.DURATION,
    column: TrendParameterColumn.DURATION,
  },
  {
    label: TrendParameterLabel.LCP,
    column: TrendParameterColumn.LCP,
  },
  {
    label: TrendParameterLabel.FCP,
    column: TrendParameterColumn.FCP,
  },
  {
    label: TrendParameterLabel.FID,
    column: TrendParameterColumn.FID,
  },
  {
    label: TrendParameterLabel.CLS,
    column: TrendParameterColumn.CLS,
  },
  {
    label: TrendParameterLabel.SPANS_HTTP,
    column: TrendParameterColumn.SPANS_HTTP,
  },
  {
    label: TrendParameterLabel.SPANS_DB,
    column: TrendParameterColumn.SPANS_DB,
  },
  {
    label: TrendParameterLabel.SPANS_BROWSER,
    column: TrendParameterColumn.SPANS_BROWSER,
  },
  {
    label: TrendParameterLabel.SPANS_RESOURCE,
    column: TrendParameterColumn.SPANS_RESOURCE,
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
  neutral: {
    lighter: theme.yellow200,
    default: theme.yellow300,
  },
  // TODO remove this once backend starts sending
  // TrendChangeType.IMPROVED as change type
  improvement: {
    lighter: theme.green200,
    default: theme.green300,
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

const TOKEN_KEYS_SUPPORTED_IN_METRICS_TRENDS = ['transaction', 'tpm()'];

export function resetCursors() {
  const cursors: Record<string, undefined> = {};
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
  return trendFunction || TRENDS_FUNCTIONS[1]!;
}

function getDefaultTrendParameter(
  projects: Project[],
  projectIds: readonly number[]
): TrendParameter {
  const performanceType = platformToPerformanceType(projects, projectIds);
  const trendParameter = performanceTypeToTrendParameterLabel(performanceType!);

  return trendParameter;
}

export function getCurrentTrendParameter(
  location: Location,
  projects: Project[],
  projectIds: readonly number[]
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
  performanceType: ProjectPerformanceType
): TrendParameter {
  switch (performanceType) {
    case ProjectPerformanceType.FRONTEND:
      return {
        label: TrendParameterLabel.LCP,
        column: TrendParameterColumn.LCP,
      };
    case ProjectPerformanceType.ANY:
    case ProjectPerformanceType.BACKEND:
    case ProjectPerformanceType.FRONTEND_OTHER:
    default:
      return {
        label: TrendParameterLabel.DURATION,
        column: TrendParameterColumn.DURATION,
      };
  }
}

export function generateTrendFunctionAsString(
  trendFunction: TrendFunctionField,
  trendParameter: string
): string {
  return generateFieldAsString({
    kind: 'function',
    function: [
      trendFunction as AggregationKeyWithAlias,
      trendParameter,
      undefined,
      undefined,
    ],
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
  canUseMetricsTrends: boolean = false
) {
  const trendFunction = getCurrentTrendFunction(location);
  const trendParameter = getCurrentTrendParameter(location, projects, trendView.project);

  const fields = ['transaction', 'project'].map(field => ({
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

  if (!canUseMetricsTrends) {
    trendView.query = getLimitTransactionItems(trendView.query);
  } else {
    const query = new MutableSearch(trendView.query);
    if (query.freeText.length > 0) {
      const parsedFreeText = query.freeText.join(' ');

      // the query here is a user entered condition, no need to escape it
      query.setFilterValues('transaction', [wrapQueryInWildcards(parsedFreeText)], false);
      query.freeText = [];
    }
    query.tokens = query.tokens.filter(
      token => token.key && TOKEN_KEYS_SUPPORTED_IN_METRICS_TRENDS.includes(token.key)
    );
    trendView.query = query.formatString();
  }

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

  const intervalFromSmoothing = getInterval(datetimeSelection, 'medium');

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
  data: TrendsTransaction[]
): NormalizedTrendsTransaction[] {
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return trendSelectedQueryKeys[trendChangeType];
}

export function getUnselectedSeries(trendChangeType: TrendChangeType) {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return trendUnselectedSeries[trendChangeType];
}

export function movingAverage(data: any, index: any, size: any) {
  return (
    data
      .slice(index - size, index)
      .map((a: any) => a.value)
      .reduce((a: any, b: any) => a + b, 0) / size
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

export function modifyTransactionNameTrendsQuery(trendView: TrendView) {
  const query = new MutableSearch(trendView.query);
  query.setFilterValues('tpm()', ['>0.1']);
  trendView.query = query.formatString();
}

export function getTopTrendingEvents(location: Location) {
  return decodeScalar(location?.query?.topEvents);
}
export {platformToPerformanceType};
