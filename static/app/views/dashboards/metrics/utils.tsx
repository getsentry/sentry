import {useMemo} from 'react';

import type {MRI} from 'sentry/types';
import {NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {parseField} from 'sentry/utils/metrics/mri';
import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiRequestQuery} from 'sentry/utils/metrics/useMetricsQuery';
import type {
  DashboardMetricsExpression,
  DashboardMetricsFormula,
  DashboardMetricsQuery,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {getQuerySymbol} from 'sentry/views/ddm/querySymbol';
import {getUniqueQueryIdGenerator} from 'sentry/views/ddm/utils/uniqueQueryId';

function extendQuery(query = '', dashboardFilters?: DashboardFilters) {
  if (!dashboardFilters?.release?.length) {
    return query;
  }

  const releaseQuery = getReleaseQuery(dashboardFilters);

  return `${query} ${releaseQuery}`.trim();
}

function getReleaseQuery(dashboardFilters: DashboardFilters) {
  const {release} = dashboardFilters;

  if (!release?.length) {
    return '';
  }

  if (release.length === 1) {
    return `release:${release[0]}`;
  }

  return `release:[${release.join(',')}]`;
}

export function isMetricsFormula(
  query: DashboardMetricsExpression
): query is DashboardMetricsFormula {
  return query.type === MetricQueryType.FORMULA;
}

export function getMetricExpressions(
  widget: Widget,
  dashboardFilters?: DashboardFilters
): DashboardMetricsExpression[] {
  const usedIds = new Set<number>();
  const indizesWithoutId: number[] = [];

  const queries = widget.queries.map((query, index) => {
    let id = query.name && Number(query.name);
    if (typeof id !== 'number' || Number.isNaN(id) || id < 0 || !Number.isInteger(id)) {
      id = NO_QUERY_ID;
      indizesWithoutId.push(index);
    } else {
      usedIds.add(id);
    }

    if (query.aggregates[0].startsWith('equation|')) {
      return {
        id: id,
        type: MetricQueryType.FORMULA,
        formula: query.aggregates[0].slice(9),
      } satisfies DashboardMetricsFormula;
    }

    const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};
    const orderBy = query.orderby ? query.orderby : undefined;
    return {
      id: id,
      type: MetricQueryType.QUERY,
      mri: parsed.mri,
      op: parsed.op,
      query: extendQuery(query.conditions, dashboardFilters),
      groupBy: query.columns,
      orderBy: orderBy as Order,
    } satisfies DashboardMetricsQuery;
  });

  if (indizesWithoutId.length > 0) {
    const generateId = getUniqueQueryIdGenerator(usedIds);
    for (const index of indizesWithoutId) {
      const query = queries[index];
      if (!query) {
        continue;
      }
      query.id = generateId.next().value;
    }
  }
  return queries;
}

export function useGenerateExpressionId(expressions: DashboardMetricsExpression[]) {
  return useMemo(() => {
    const usedIds = new Set<number>(expressions.map(e => e.id));
    return () => getUniqueQueryIdGenerator(usedIds).next().value;
  }, [expressions]);
}

export function expressionsToApiQueries(
  expressions: DashboardMetricsExpression[]
): MetricsQueryApiRequestQuery[] {
  return expressions
    .filter((e): e is DashboardMetricsQuery => !isMetricsFormula(e))
    .map(e => ({...e, name: getQuerySymbol(e.id)}));
}

export function toMetricDisplayType(displayType: unknown): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}
