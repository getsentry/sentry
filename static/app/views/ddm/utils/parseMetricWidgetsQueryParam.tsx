import {getDefaultMetricOp} from 'sentry/utils/metrics';
import {
  DEFAULT_SORT_STATE,
  emptyMetricsQueryWidget,
  NO_QUERY_ID,
} from 'sentry/utils/metrics/constants';
import {isMRI} from 'sentry/utils/metrics/mri';
import {
  type BaseWidgetParams,
  type FocusedMetricsSeries,
  MetricDisplayType,
  type MetricFormulaWidgetParams,
  MetricQueryType,
  type MetricQueryWidgetParams,
  type MetricWidgetQueryParams,
  type SortState,
} from 'sentry/utils/metrics/types';
import {getUniqueQueryIdGenerator} from 'sentry/views/ddm/utils/uniqueQueryId';

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
  if (!Array.isArray(widget[key])) {
    const entry = entryParser(widget[key]);
    return entry === undefined ? [] : [entry];
  }

  return widget[key].map(entryParser).filter((entry): entry is T => entry !== undefined);
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

  if (
    name === 'name' ||
    name === 'avg' ||
    name === 'min' ||
    name === 'max' ||
    name === 'sum'
  ) {
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
): MetricQueryType | undefined {
  const value = widget[key];
  return typeof value === 'number' && Object.values(MetricQueryType).includes(value)
    ? value
    : undefined;
}

function parseQueryWidget(
  widget: Record<string, unknown>,
  baseWidgetParams: BaseWidgetParams
): MetricQueryWidgetParams | null {
  const mri = getMRIParam(widget);
  // If we cannot retrieve an MRI, there is nothing to display
  if (!mri) {
    return null;
  }

  return {
    mri,
    op: parseStringParam(widget, 'op') ?? getDefaultMetricOp(mri),
    query: parseStringParam(widget, 'query') ?? '',
    groupBy: parseArrayParam(widget, 'groupBy', entry =>
      typeof entry === 'string' ? entry : undefined
    ),
    powerUserMode: parseBooleanParam(widget, 'powerUserMode') ?? false,
    ...baseWidgetParams,
    type: MetricQueryType.QUERY,
  };
}

function parseFormulaWidget(
  widget: Record<string, unknown>,
  baseWidgetParams: BaseWidgetParams
): MetricFormulaWidgetParams | null {
  const formula = parseStringParam(widget, 'formula');
  // If we cannot retrieve a formula, there is nothing to display
  if (formula === undefined) {
    return null;
  }

  return {
    formula,
    ...baseWidgetParams,
    type: MetricQueryType.FORMULA,
  };
}

export function parseMetricWidgetsQueryParam(
  queryParam?: string
): MetricWidgetQueryParams[] {
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

  const usedIds = new Set<number>();
  const indezesWithoutId = new Set<number>();

  const parsedWidgets = (currentWidgets as unknown[]).map(
    (widget: unknown, index): MetricWidgetQueryParams | null => {
      if (!isRecord(widget)) {
        return null;
      }

      const type = parseQueryType(widget, 'type') ?? MetricQueryType.QUERY;

      const id = parseNumberParam(widget, 'id');
      if (!isValidId(id)) {
        indezesWithoutId.add(index);
      } else if (usedIds.has(id)) {
        // We drop qidgets with duplicate ids
        return null;
      } else {
        usedIds.add(id);
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
      };

      switch (type) {
        case MetricQueryType.QUERY:
          return parseQueryWidget(widget, baseWidgetParams);
        case MetricQueryType.FORMULA:
          return parseFormulaWidget(widget, baseWidgetParams);
        default:
          return null;
      }
    }
  );

  // Iterate over the widgets without an id and assign them a unique one
  if (indezesWithoutId.size > 0) {
    const generateId = getUniqueQueryIdGenerator(usedIds);
    for (const index of indezesWithoutId) {
      const widget = parsedWidgets[index];
      if (!widget) {
        continue;
      }
      widget.id = generateId.next().value;
    }
  }

  const filteredWidgets = parsedWidgets.filter(
    (widget): widget is MetricWidgetQueryParams => widget !== null
  );

  if (filteredWidgets.length === 0) {
    filteredWidgets.push(emptyMetricsQueryWidget);
  }

  // We can reset the id if there is only one widget
  if (filteredWidgets.length === 1) {
    filteredWidgets[0].id = 0;
  }

  return filteredWidgets;
}
