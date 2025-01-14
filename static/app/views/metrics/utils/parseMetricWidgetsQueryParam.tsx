import type {MetricAggregation} from 'sentry/types/metrics';
import {getDefaultAggregation, isMetricsAggregation} from 'sentry/utils/metrics';
import {DEFAULT_SORT_STATE, NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {isMRI} from 'sentry/utils/metrics/mri';
import {
  type BaseWidgetParams,
  type FocusedMetricsSeries,
  MetricChartOverlayType,
  MetricDisplayType,
  MetricExpressionType,
  type MetricsEquationWidget,
  type MetricsQueryWidget,
  type MetricsWidget,
  type SortState,
} from 'sentry/utils/metrics/types';
import {getUniqueQueryIdGenerator} from 'sentry/views/metrics/utils/uniqueQueryId';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMetricDisplayType(value: unknown): value is MetricDisplayType {
  return Object.values(MetricDisplayType).includes(value as MetricDisplayType);
}

function getMRIParam(widget: Record<string, unknown>) {
  return 'mri' in widget && isMRI(widget.mri) ? widget.mri : undefined;
}

function parseStringParam(
  widget: Record<string, unknown>,
  key: string
): string | undefined {
  const value = widget[key];
  return typeof value === 'string' ? value : undefined;
}

function parseNumberParam(
  widget: Record<string, unknown>,
  key: string
): number | undefined {
  const value = widget[key];
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

function parseBooleanParam(
  widget: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = widget[key];
  return typeof value === 'boolean' ? value : undefined;
}

function parseArrayParam<T extends Exclude<any, undefined>>(
  widget: object,
  key: string,
  entryParser: (entry: unknown) => T | undefined
): T[] {
  if (!(key in widget)) {
    return [];
  }

  // allow single values instead of arrays
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (!Array.isArray(widget[key])) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const entry = entryParser(widget[key]);
    return entry === undefined ? [] : [entry];
  }

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return widget[key]
    .map(entryParser)
    .filter((entry: any): entry is T => entry !== undefined);
}

function parseFocusedSeries(series: any): FocusedMetricsSeries | undefined {
  if (!isRecord(series)) {
    return undefined;
  }
  const id = parseStringParam(series, 'id');
  const groupBy =
    'groupBy' in series && isRecord(series.groupBy)
      ? (series.groupBy as Record<string, string>)
      : undefined;

  if (!id) {
    return undefined;
  }

  return {id, groupBy};
}

function parseSortParam(widget: Record<string, unknown>, key: string): SortState {
  const sort = widget[key];
  if (!isRecord(sort)) {
    return DEFAULT_SORT_STATE;
  }

  const name = parseStringParam(sort, 'name');
  const order =
    'order' in sort && (sort.order === 'desc' || sort.order === 'asc')
      ? sort.order
      : DEFAULT_SORT_STATE.order;

  if (name && (name === 'name' || isMetricsAggregation(name))) {
    return {name, order};
  }

  return {name: undefined, order};
}

function isValidId(n: number | undefined): n is number {
  return n !== undefined && Number.isInteger(n) && n >= 0;
}

function parseQueryType(
  widget: Record<string, unknown>,
  key: string
): MetricExpressionType | undefined {
  const value = widget[key];
  return typeof value === 'number' && Object.values(MetricExpressionType).includes(value)
    ? value
    : undefined;
}

function parseAggregation(
  widget: Record<string, unknown>
): MetricAggregation | undefined {
  const aggregation =
    parseStringParam(widget, 'aggregation') ?? parseStringParam(widget, 'op');
  if (!aggregation) {
    return undefined;
  }
  return aggregation as MetricAggregation;
}

function parseQueryWidget(
  widget: Record<string, unknown>,
  baseWidgetParams: BaseWidgetParams
): MetricsQueryWidget | null {
  const mri = getMRIParam(widget);
  // If we cannot retrieve an MRI, there is nothing to display
  if (!mri) {
    return null;
  }

  return {
    mri,
    aggregation: parseAggregation(widget) ?? getDefaultAggregation(mri),
    condition: parseNumberParam(widget, 'condition'),
    query: parseStringParam(widget, 'query') ?? '',
    groupBy: parseArrayParam(widget, 'groupBy', entry =>
      typeof entry === 'string' ? entry : undefined
    ),
    powerUserMode: parseBooleanParam(widget, 'powerUserMode') ?? false,
    ...baseWidgetParams,
    type: MetricExpressionType.QUERY,
  };
}

function parseFormulaWidget(
  widget: Record<string, unknown>,
  baseWidgetParams: BaseWidgetParams
): MetricsEquationWidget | null {
  const formula = parseStringParam(widget, 'formula');
  // If we cannot retrieve a formula, there is nothing to display
  if (formula === undefined) {
    return null;
  }

  return {
    formula,
    ...baseWidgetParams,
    type: MetricExpressionType.EQUATION,
  };
}

function parseQueryId(widget: Record<string, unknown>, key: string): number {
  const value = parseNumberParam(widget, key);
  return isValidId(value) ? value : NO_QUERY_ID;
}

function fillIds(
  entries: MetricsWidget[],
  indicesWithoutId: Set<number>,
  usedIds: Set<number>
): MetricsWidget[] {
  if (indicesWithoutId.size > 0) {
    const generateId = getUniqueQueryIdGenerator(usedIds);
    for (const index of indicesWithoutId) {
      const widget = entries[index];
      if (!widget) {
        continue;
      }
      widget.id = generateId.next().value;
    }
  }
  return entries;
}

export function parseMetricWidgetsQueryParam(queryParam?: string): MetricsWidget[] {
  let currentWidgets: unknown = undefined;

  try {
    currentWidgets = JSON.parse(queryParam || '');
  } catch (_) {
    currentWidgets = [];
  }

  // It has to be an array and non-empty
  if (!Array.isArray(currentWidgets)) {
    currentWidgets = [];
  }

  const queries: MetricsQueryWidget[] = [];
  const usedQueryIds = new Set<number>();
  const queryIndicesWithoutId = new Set<number>();

  const formulas: MetricsEquationWidget[] = [];
  const usedFormulaIds = new Set<number>();
  const formulaIndicesWithoutId = new Set<number>();

  (currentWidgets as unknown[]).forEach((widget: unknown) => {
    if (!isRecord(widget)) {
      return;
    }

    const type = parseQueryType(widget, 'type') ?? MetricExpressionType.QUERY;

    const id = parseQueryId(widget, 'id');
    if (
      type === MetricExpressionType.QUERY ? usedQueryIds.has(id) : usedFormulaIds.has(id)
    ) {
      // We drop widgets with duplicate ids
      return;
    }
    if (id !== NO_QUERY_ID) {
      if (type === MetricExpressionType.QUERY) {
        usedQueryIds.add(id);
      } else {
        usedFormulaIds.add(id);
      }
    }

    const displayType = parseStringParam(widget, 'displayType');

    const baseWidgetParams: BaseWidgetParams = {
      type,
      id: !isValidId(id) ? NO_QUERY_ID : id,
      displayType: isMetricDisplayType(displayType)
        ? displayType
        : MetricDisplayType.LINE,
      focusedSeries: parseArrayParam(widget, 'focusedSeries', parseFocusedSeries),
      sort: parseSortParam(widget, 'sort'),
      isHidden: parseBooleanParam(widget, 'isHidden') ?? false,
      overlays: widget.overlays
        ? parseArrayParam(widget, 'overlays', entry => entry as MetricChartOverlayType)
        : [MetricChartOverlayType.SAMPLES],
    };

    switch (type) {
      case MetricExpressionType.QUERY: {
        const query = parseQueryWidget(widget, baseWidgetParams);
        if (!query) {
          break;
        }
        queries.push(query);
        if (query.id === NO_QUERY_ID) {
          queryIndicesWithoutId.add(queries.length - 1);
        }
        break;
      }
      case MetricExpressionType.EQUATION: {
        const formula = parseFormulaWidget(widget, baseWidgetParams);
        if (!formula) {
          break;
        }
        formulas.push(formula);
        if (formula.id === NO_QUERY_ID) {
          formulaIndicesWithoutId.add(formulas.length - 1);
        }
        break;
      }
      default:
        break;
    }
  });

  // We can reset the id if there is only one widget
  if (queries.length === 1) {
    queries[0]!.id = 0;
  }

  if (formulas.length === 1) {
    formulas[0]!.id = 0;
  }

  return [
    ...fillIds(queries, queryIndicesWithoutId, usedQueryIds),
    ...fillIds(formulas, formulaIndicesWithoutId, usedFormulaIds),
  ];
}
