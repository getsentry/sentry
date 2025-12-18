import type {Theme} from '@emotion/react';
import {ASAP} from 'downsample/methods/ASAP';
import type {Location} from 'history';
import moment from 'moment-timezone';

import {getInterval} from 'sentry/components/charts/utils';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {Project} from 'sentry/types/project';
import type {AggregationKeyWithAlias, Field, Sort} from 'sentry/utils/discover/fields';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {
  NormalizedTrendsTransaction,
  TrendFunction,
  TrendParameter,
  TrendsTransaction,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {
  TrendChangeType,
  TrendFunctionField,
  TrendParameterColumn,
  TrendParameterLabel,
} from 'sentry/views/performance/trends/types';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

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

export function makeTrendToColorMapping(theme: Theme) {
  return {
    [TrendChangeType.IMPROVED]: {
      lighter: theme.colors.green200,
      default: theme.colors.green400,
    },
    [TrendChangeType.REGRESSION]: {
      lighter: theme.colors.red200,
      default: theme.colors.red400,
    },
    neutral: {
      lighter: theme.colors.yellow200,
      default: theme.colors.yellow400,
    },
    // TODO remove this once backend starts sending
    // TrendChangeType.IMPROVED as change type
    improvement: {
      lighter: theme.colors.green200,
      default: theme.colors.green400,
    },
  };
}

const trendUnselectedSeries = {
  [TrendChangeType.IMPROVED]: 'improvedUnselectedSeries',
  [TrendChangeType.REGRESSION]: 'regressionUnselectedSeries',
};

const TOKEN_KEYS_SUPPORTED_IN_METRICS_TRENDS = ['transaction', 'tpm()'];

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

function generateTrendFunctionAsString(
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

export function modifyTrendView(
  trendView: TrendView,
  location: Location,
  trendsType: TrendChangeType,
  projects: Project[],
  canUseMetricsTrends = false
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

  if (canUseMetricsTrends) {
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
  } else {
    trendView.query = getLimitTransactionItems(trendView.query);
  }

  trendView.interval = getQueryInterval(location, trendView);

  trendView.sorts = [trendSort];
  trendView.fields = fields;
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

export function getUnselectedSeries(trendChangeType: TrendChangeType) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return trendUnselectedSeries[trendChangeType];
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

const smoothTrend = (data: Array<[number, number]>, resolution = 100) => {
  return ASAP(data, resolution);
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

    // smoothed is not iterable - only indexable
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
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

export function getTopTrendingEvents(location: Location) {
  return decodeScalar(location?.query?.topEvents);
}
