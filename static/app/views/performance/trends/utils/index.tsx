import type {Location} from 'history';

import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import type {TrendFunction, TrendParameter} from 'sentry/views/performance/trends/types';
import {
  TrendFunctionField,
  TrendParameterColumn,
  TrendParameterLabel,
} from 'sentry/views/performance/trends/types';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

const TRENDS_FUNCTIONS: TrendFunction[] = [
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

const TRENDS_PARAMETERS: TrendParameter[] = [
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

export function getTopTrendingEvents(location: Location) {
  return decodeScalar(location?.query?.topEvents);
}
