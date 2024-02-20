import {getDefaultMetricDisplayType, getDefaultMetricOp} from 'sentry/utils/metrics';
import {DEFAULT_SORT_STATE, NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {isMRI} from 'sentry/utils/metrics/mri';
import {
  type FocusedMetricsSeries,
  MetricDisplayType,
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
  const seriesName = parseStringParam(series, 'seriesName');
  const groupBy =
    'groupBy' in series && isRecord(series.groupBy)
      ? (series.groupBy as Record<string, string>)
      : undefined;

  if (!seriesName) {
    return undefined;
  }

  return {seriesName, groupBy};
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

export function parseMetricWidgetsQueryParam(
  queryParam?: string
): MetricWidgetQueryParams[] | undefined {
  let currentWidgets: unknown = undefined;

  try {
    currentWidgets = JSON.parse(queryParam || '');
  } catch (_) {
    return undefined;
  }

  // It has to be an array and non-empty
  if (!Array.isArray(currentWidgets) || currentWidgets.length === 0) {
    return undefined;
  }

  const usedIds = new Set<number>();
  const indezesWithoutId = new Set<number>();

  const parsedWidgets = currentWidgets
    .map((widget: unknown, index): MetricWidgetQueryParams | null => {
      if (!isRecord(widget)) {
        return null;
      }

      const mri = getMRIParam(widget);
      // If we cannot retrieve an MRI the resulting widget will be useless anyway
      if (!mri) {
        return null;
      }

      const id = parseNumberParam(widget, 'id');
      if (!isValidId(id)) {
        indezesWithoutId.add(index);
      } else if (usedIds.has(id)) {
        // We drop qidgets with duplicate ids
        return null;
      } else {
        usedIds.add(id);
      }

      const op = parseStringParam(widget, 'op');
      const displayType = parseStringParam(widget, 'displayType');

      return {
        id: !isValidId(id) ? NO_QUERY_ID : id,
        mri,
        op: parseStringParam(widget, 'op') ?? getDefaultMetricOp(mri),
        query: parseStringParam(widget, 'query') ?? '',
        groupBy: parseArrayParam(widget, 'groupBy', entry =>
          typeof entry === 'string' ? entry : undefined
        ),
        displayType: isMetricDisplayType(displayType)
          ? displayType
          : getDefaultMetricDisplayType(mri, op),
        focusedSeries: parseArrayParam(widget, 'focusedSeries', parseFocusedSeries),
        powerUserMode: parseBooleanParam(widget, 'powerUserMode') ?? false,
        sort: parseSortParam(widget, 'sort'),
      };
    })
    .filter((widget): widget is MetricWidgetQueryParams => !!widget);

  // Iterate over the widgets without an id and assign them a unique one
  if (indezesWithoutId.size > 0) {
    const generateId = getUniqueQueryIdGenerator(usedIds);
    for (const index of indezesWithoutId) {
      parsedWidgets[index].id = generateId.next().value;
    }
  }

  // We can reset the id if there is only one widget
  if (parsedWidgets.length === 1) {
    parsedWidgets[0].id = 0;
  }

  return parsedWidgets.length > 0 ? parsedWidgets : undefined;
}
