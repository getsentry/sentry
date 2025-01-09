import {useMemo} from 'react';

import {getEquationSymbol} from 'sentry/components/metrics/equationSymbol';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import {
  getDefaultAggregation,
  isVirtualMetric,
  unescapeMetricsFormula,
} from 'sentry/utils/metrics';
import {NO_QUERY_ID, SPAN_DURATION_MRI} from 'sentry/utils/metrics/constants';
import {formatMRIField, MRIToField, parseField} from 'sentry/utils/metrics/mri';
import {MetricDisplayType, MetricExpressionType} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';
import type {
  DashboardMetricsEquation,
  DashboardMetricsExpression,
  DashboardMetricsQuery,
} from 'sentry/views/dashboards/metrics/types';
import {
  type DashboardFilters,
  DisplayType,
  type Widget,
  type WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {getUniqueQueryIdGenerator} from 'sentry/views/metrics/utils/uniqueQueryId';

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

export function isMetricsEquation(
  query: DashboardMetricsExpression
): query is DashboardMetricsEquation {
  return query.type === MetricExpressionType.EQUATION;
}

function getExpressionIdFromWidgetQuery(query: WidgetQuery): number {
  let id = query.name && Number(query.name);
  if (typeof id !== 'number' || Number.isNaN(id) || id < 0 || !Number.isInteger(id)) {
    id = NO_QUERY_ID;
  }
  return id;
}

function fillMissingExpressionIds(
  expressions: (DashboardMetricsExpression | null)[],
  indizesWithoutId: number[],
  usedIds: Set<number>
): (DashboardMetricsExpression | null)[] {
  if (indizesWithoutId.length > 0) {
    const generateId = getUniqueQueryIdGenerator(usedIds);
    for (const index of indizesWithoutId) {
      const expression = expressions[index];
      if (!expression) {
        continue;
      }
      expression.id = generateId.next().value;
    }
  }

  return expressions;
}

export function getMetricQueries(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  getVirtualMRIQuery: (
    mri: MRI,
    aggregation: MetricAggregation
  ) => {
    aggregation: MetricAggregation;
    conditionId: number;
    mri: MRI;
  } | null
): DashboardMetricsQuery[] {
  const usedIds = new Set<number>();
  const indizesWithoutId: number[] = [];

  const queries = widget.queries.map((query, index): DashboardMetricsQuery | null => {
    if (query.aggregates[0]!.startsWith('equation|')) {
      return null;
    }

    const id = getExpressionIdFromWidgetQuery(query);
    if (id === NO_QUERY_ID) {
      indizesWithoutId.push(index);
    } else {
      usedIds.add(id);
    }

    const parsed = parseField(query.aggregates[0]!);
    if (!parsed) {
      return null;
    }

    let mri = parsed.mri;
    let condition: number | undefined = undefined;
    let aggregation = parsed.aggregation;
    const resolved = getVirtualMRIQuery(mri, aggregation);
    if (resolved) {
      if (resolved) {
        aggregation = resolved.aggregation;
        mri = resolved.mri;
        condition = resolved.conditionId;
      }
    }

    const orderBy = query.orderby ? query.orderby : undefined;
    return {
      id,
      type: MetricExpressionType.QUERY,
      condition,
      mri,
      aggregation,
      query: extendQuery(query.conditions, dashboardFilters),
      groupBy: query.columns,
      orderBy: orderBy === 'asc' || orderBy === 'desc' ? orderBy : undefined,
      isHidden: !!query.isHidden,
      alias: query.fieldAliases?.[0],
    };
  });

  return fillMissingExpressionIds(queries, indizesWithoutId, usedIds).filter(
    (query): query is DashboardMetricsQuery => query !== null
  );
}

export function getMetricEquations(widget: Widget): DashboardMetricsEquation[] {
  const usedIds = new Set<number>();
  const indicesWithoutId: number[] = [];

  const equations = widget.queries.map(
    (query, index): DashboardMetricsEquation | null => {
      if (!query.aggregates[0]!.startsWith('equation|')) {
        return null;
      }

      const id = getExpressionIdFromWidgetQuery(query);
      if (id === NO_QUERY_ID) {
        indicesWithoutId.push(index);
      } else {
        usedIds.add(id);
      }

      return {
        id,
        type: MetricExpressionType.EQUATION,
        formula: query.aggregates[0]!.slice(9),
        isHidden: !!query.isHidden,
        alias: query.fieldAliases?.[0],
      } satisfies DashboardMetricsEquation;
    }
  );

  return fillMissingExpressionIds(equations, indicesWithoutId, usedIds).filter(
    (query): query is DashboardMetricsEquation => query !== null
  );
}

export function getMetricExpressions(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  getVirtualMRIQuery: (
    mri: MRI,
    aggregation: MetricAggregation
  ) => {
    aggregation: MetricAggregation;
    conditionId: number;
    mri: MRI;
  } | null
): DashboardMetricsExpression[] {
  return [
    ...getMetricQueries(widget, dashboardFilters, getVirtualMRIQuery),
    ...getMetricEquations(widget),
  ];
}

export function useGenerateExpressionId(expressions: DashboardMetricsExpression[]) {
  return useMemo(() => {
    const usedIds = new Set<number>(expressions.map(e => e.id));
    return () => getUniqueQueryIdGenerator(usedIds).next().value;
  }, [expressions]);
}

export function expressionsToApiQueries(
  expressions: DashboardMetricsExpression[],
  metricsNewInputs: boolean
): MetricsQueryApiQueryParams[] {
  return expressions
    .filter(e => !(e.type === MetricExpressionType.EQUATION && e.isHidden))
    .map(e =>
      isMetricsEquation(e)
        ? {
            alias: e.alias,
            formula: e.formula,
            name: getEquationSymbol(e.id, metricsNewInputs),
          }
        : {...e, name: getQuerySymbol(e.id, metricsNewInputs), isQueryOnly: e.isHidden}
    );
}

export function toMetricDisplayType(displayType: unknown): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}

function getWidgetQuery(metricsQuery: DashboardMetricsQuery): WidgetQuery {
  const field = MRIToField(metricsQuery.mri, metricsQuery.aggregation);

  return {
    name: `${metricsQuery.id}`,
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    orderby: metricsQuery.orderBy ?? '',
    isHidden: metricsQuery.isHidden,
    fieldAliases: metricsQuery.alias ? [metricsQuery.alias] : [],
  };
}

function getWidgetEquation(metricsEquation: DashboardMetricsEquation): WidgetQuery {
  return {
    name: `${metricsEquation.id}`,
    aggregates: [`equation|${metricsEquation.formula}`],
    columns: [],
    fields: [`equation|${metricsEquation.formula}`],
    isHidden: metricsEquation.isHidden,
    fieldAliases: metricsEquation.alias ? [metricsEquation.alias] : [],
    // Not used for equations
    conditions: '',
    orderby: '',
  };
}

export function expressionsToWidget(
  expressions: DashboardMetricsExpression[],
  title: string,
  displayType: DisplayType,
  interval = '5m'
): Widget {
  return {
    title,
    interval,
    displayType,
    widgetType: WidgetType.METRICS,
    limit: 10,
    queries: expressions.map(e => {
      if (isMetricsEquation(e)) {
        return getWidgetEquation(e);
      }
      return getWidgetQuery(e);
    }),
  };
}

export function getMetricWidgetTitle(queries: DashboardMetricsExpression[]) {
  return queries.map(getMetricQueryName).join(', ');
}

export function getMetricQueryName(query: DashboardMetricsExpression): string {
  return (
    query.alias ??
    (isMetricsEquation(query)
      ? unescapeMetricsFormula(query.formula)
      : formatMRIField(MRIToField(query.mri, query.aggregation)))
  );
}

export function defaultMetricWidget(): Widget {
  return expressionsToWidget(
    [
      {
        id: 0,
        type: MetricExpressionType.QUERY,
        mri: SPAN_DURATION_MRI,
        aggregation: getDefaultAggregation(SPAN_DURATION_MRI),
        query: '',
        orderBy: 'desc',
        isHidden: false,
      },
    ],
    '',
    DisplayType.LINE
  );
}

export const isVirtualExpression = (expression: DashboardMetricsExpression) => {
  if ('mri' in expression) {
    return isVirtualMetric(expression);
  }
  return false;
};

export const isVirtualAlias = (alias?: string) => {
  return alias?.startsWith('v|');
};

export const formatAlias = (alias?: string) => {
  if (!alias) {
    return alias;
  }

  if (!isVirtualAlias(alias)) {
    return alias;
  }

  return alias.replace('v|', '');
};

export const getVirtualAlias = (aggregation, spanAttribute) => {
  return `v|${aggregation}(${spanAttribute})`;
};
