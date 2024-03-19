import {useMemo} from 'react';

import type {MRI} from 'sentry/types';
import {unescapeMetricsFormula} from 'sentry/utils/metrics';
import {NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {formatMRIField, MRIToField, parseField} from 'sentry/utils/metrics/mri';
import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';
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
import {getEquationSymbol} from 'sentry/views/ddm/equationSymbol copy';
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
): query is DashboardMetricsEquation {
  return query.type === MetricQueryType.FORMULA;
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
  dashboardFilters?: DashboardFilters
): DashboardMetricsQuery[] {
  const usedIds = new Set<number>();
  const indizesWithoutId: number[] = [];

  const queries = widget.queries.map((query, index): DashboardMetricsQuery | null => {
    if (query.aggregates[0].startsWith('equation|')) {
      return null;
    }

    const id = getExpressionIdFromWidgetQuery(query);
    if (id === NO_QUERY_ID) {
      indizesWithoutId.push(index);
    } else {
      usedIds.add(id);
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
      orderBy: orderBy === 'asc' || orderBy === 'desc' ? orderBy : undefined,
    };
  });

  return fillMissingExpressionIds(queries, indizesWithoutId, usedIds).filter(
    (query): query is DashboardMetricsQuery => query !== null
  );
}

export function getMetricEquations(widget: Widget): DashboardMetricsEquation[] {
  const usedIds = new Set<number>();
  const indizesWithoutId: number[] = [];

  const equations = widget.queries.map(
    (query, index): DashboardMetricsEquation | null => {
      if (!query.aggregates[0].startsWith('equation|')) {
        return null;
      }

      const id = getExpressionIdFromWidgetQuery(query);
      if (id === NO_QUERY_ID) {
        indizesWithoutId.push(index);
      } else {
        usedIds.add(id);
      }

      return {
        id: id,
        type: MetricQueryType.FORMULA,
        formula: query.aggregates[0].slice(9),
      } satisfies DashboardMetricsEquation;
    }
  );

  return fillMissingExpressionIds(equations, indizesWithoutId, usedIds).filter(
    (query): query is DashboardMetricsEquation => query !== null
  );
}

export function getMetricExpressions(
  widget: Widget,
  dashboardFilters?: DashboardFilters
): DashboardMetricsExpression[] {
  return [...getMetricQueries(widget, dashboardFilters), ...getMetricEquations(widget)];
}

export function useGenerateExpressionId(expressions: DashboardMetricsExpression[]) {
  return useMemo(() => {
    const usedIds = new Set<number>(expressions.map(e => e.id));
    return () => getUniqueQueryIdGenerator(usedIds).next().value;
  }, [expressions]);
}

export function expressionsToApiQueries(
  expressions: DashboardMetricsExpression[]
): MetricsQueryApiQueryParams[] {
  return expressions.map(e =>
    isMetricsFormula(e)
      ? {
          formula: e.formula,
          name: getEquationSymbol(e.id),
        }
      : {...e, name: getQuerySymbol(e.id)}
  );
}

export function toMetricDisplayType(displayType: unknown): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}

function getWidgetQuery(metricsQuery: DashboardMetricsQuery): WidgetQuery {
  const field = MRIToField(metricsQuery.mri, metricsQuery.op);

  return {
    name: `${metricsQuery.id}`,
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    orderby: metricsQuery.orderBy ?? '',
  };
}

function getWidgetEquation(metricsFormula: DashboardMetricsEquation): WidgetQuery {
  return {
    name: `${metricsFormula.id}`,
    aggregates: [`equation|${metricsFormula.formula}`],
    columns: [],
    fields: [`equation|${metricsFormula.formula}`],
    // Not used for equations
    conditions: '',
    orderby: '',
  };
}

export function expressionsToWidget(
  expressions: DashboardMetricsExpression[],
  title: string,
  displayType: DisplayType
): Widget {
  return {
    title,
    // The interval has no effect on metrics widgets but the BE requires it
    interval: '5m',
    displayType: displayType,
    widgetType: WidgetType.METRICS,
    limit: 10,
    queries: expressions.map(e => {
      if (isMetricsFormula(e)) {
        return getWidgetEquation(e);
      }
      return getWidgetQuery(e);
    }),
  };
}

export function getMetricWidgetTitle(queries: DashboardMetricsExpression[]) {
  return queries
    .map(q =>
      isMetricsFormula(q)
        ? unescapeMetricsFormula(q.formula)
        : formatMRIField(MRIToField(q.mri, q.op))
    )
    .join(', ');
}

export function defaultMetricWidget(): Widget {
  return expressionsToWidget(
    [
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'avg',
        query: '',
        orderBy: 'desc',
      },
    ],
    '',
    DisplayType.LINE
  );
}

export function filterQueriesByDisplayType(
  queries: DashboardMetricsQuery[],
  displayType: DisplayType
) {
  // Big number can display only one query
  if (displayType === DisplayType.BIG_NUMBER) {
    return queries.slice(0, 1);
  }
  return queries;
}

export function filterEquationsByDisplayType(
  equations: DashboardMetricsEquation[],
  displayType: DisplayType
) {
  // Big number can display only one query
  if (displayType === DisplayType.BIG_NUMBER) {
    return [];
  }
  // TODO: Add support for table
  if (displayType === DisplayType.TABLE) {
    return [];
  }
  return equations;
}
