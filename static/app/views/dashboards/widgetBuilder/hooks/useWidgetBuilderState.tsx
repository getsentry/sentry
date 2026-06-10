import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';
import * as qs from 'query-string';

import {defined} from 'sentry/utils/defined';
import {
  explodeField,
  generateFieldAsString,
  getEquationAliasIndex,
  isAggregateFieldOrEquation,
  isEquationAlias,
  type Column,
  type QueryFieldValue,
  type Sort,
} from 'sentry/utils/discover/fields';
import {
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DEFAULT_CATEGORICAL_BAR_LIMIT,
  DisplayType,
  WidgetType,
  type LegendType,
  type LinkedDashboard,
  type Widget,
} from 'sentry/views/dashboards/types';
import {
  doesDisplayTypeSupportThresholds,
  usesTimeSeriesData,
} from 'sentry/views/dashboards/utils';
import {getAxisRange, type AxisRange} from 'sentry/views/dashboards/utils/axisRange';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';
import {
  DISABLED_SORT,
  TAG_SORT_DENY_LIST,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {
  DEFAULT_RESULTS_LIMIT,
  getResultsLimit,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {SpanFields} from 'sentry/views/insights/types';

// For issues dataset, events and users are sorted descending and do not use '-'
// All other issues fields are sorted ascending
const REVERSED_ORDER_FIELD_SORT_LIST = ['freq', 'user'];

const DETAIL_WIDGET_FIELDS: DefaultDetailWidgetFields[] = [
  SpanFields.ID,
  SpanFields.SPAN_OP,
  SpanFields.SPAN_GROUP,
  SpanFields.SPAN_DESCRIPTION,
  SpanFields.SPAN_CATEGORY,
] as const;

export const MAX_NUM_Y_AXES = 3;
const URL_SYNC_DEBOUNCE_MS = 300;

export const WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP: Record<
  keyof WidgetBuilderStateLocalParams,
  {key: string; storeCondition: (widget: Widget) => boolean; widgetField: keyof Widget}
> = {
  textContent: {
    key: 'dashboard:widget-builder:text-content',
    widgetField: 'description',
    storeCondition: (widget: Widget) => widget.displayType === DisplayType.TEXT,
  },
};

export type WidgetBuilderStateQueryParams = {
  axisRange?: AxisRange;
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  field?: string[];
  legendAlias?: string[];
  legendType?: LegendType;
  limit?: number;
  linkedDashboards?: string[];
  query?: string[];
  selectedAggregate?: number;
  sort?: string[];
  thresholds?: string;
  title?: string;
  yAxis?: string[];
};

type WidgetBuilderStateLocalParams = {
  textContent?: string;
};

/**
 * Extends the URL query params shape with `textContent` for text widgets.
 * Used as the payload type for SET_STATE actions, where text widget content
 * must be carried in-memory without being written to the URL.
 */
export type WidgetBuilderStateParams = WidgetBuilderStateQueryParams &
  WidgetBuilderStateLocalParams;

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
  SET_DISPLAY_TYPE: 'SET_DISPLAY_TYPE',
  SET_DATASET: 'SET_DATASET',
  SET_FIELDS: 'SET_FIELDS',
  SET_Y_AXIS: 'SET_Y_AXIS',
  SET_QUERY: 'SET_QUERY',
  SET_SORT: 'SET_SORT',
  SET_LINKED_DASHBOARDS: 'SET_LINKED_DASHBOARDS',
  SET_LIMIT: 'SET_LIMIT',
  SET_LEGEND_ALIAS: 'SET_LEGEND_ALIAS',
  SET_LEGEND_TYPE: 'SET_LEGEND_TYPE',
  SET_SELECTED_AGGREGATE: 'SET_SELECTED_AGGREGATE',
  SET_STATE: 'SET_STATE',
  SET_TEXT_CONTENT: 'SET_TEXT_CONTENT',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
  // Categorical bar chart specific actions
  SET_CATEGORICAL_X_AXIS: 'SET_CATEGORICAL_X_AXIS',
  SET_CATEGORICAL_AGGREGATE: 'SET_CATEGORICAL_AGGREGATE',
  DELETE_AGGREGATE: 'DELETE_AGGREGATE',
  SET_AXIS_RANGE: 'SET_AXIS_RANGE',
} as const;

type WidgetAction =
  | {payload: string; type: typeof BuilderStateAction.SET_TITLE}
  | {payload: string; type: typeof BuilderStateAction.SET_DESCRIPTION}
  | {payload: DisplayType; type: typeof BuilderStateAction.SET_DISPLAY_TYPE}
  | {payload: WidgetType; type: typeof BuilderStateAction.SET_DATASET}
  | {payload: Column[]; type: typeof BuilderStateAction.SET_FIELDS}
  | {payload: Column[]; type: typeof BuilderStateAction.SET_Y_AXIS}
  | {payload: string[]; type: typeof BuilderStateAction.SET_QUERY}
  | {payload: Sort[]; type: typeof BuilderStateAction.SET_SORT}
  | {payload: LinkedDashboard[]; type: typeof BuilderStateAction.SET_LINKED_DASHBOARDS}
  | {payload: number; type: typeof BuilderStateAction.SET_LIMIT}
  | {payload: string[]; type: typeof BuilderStateAction.SET_LEGEND_ALIAS}
  | {
      payload: LegendType | undefined;
      type: typeof BuilderStateAction.SET_LEGEND_TYPE;
    }
  | {payload: number | undefined; type: typeof BuilderStateAction.SET_SELECTED_AGGREGATE}
  | {payload: WidgetBuilderStateParams; type: typeof BuilderStateAction.SET_STATE}
  | {
      payload: ThresholdsConfig | null | undefined;
      type: typeof BuilderStateAction.SET_THRESHOLDS;
    }
  | {
      payload: string;
      type: typeof BuilderStateAction.SET_CATEGORICAL_X_AXIS;
    }
  | {
      payload: Column[];
      type: typeof BuilderStateAction.SET_CATEGORICAL_AGGREGATE;
    }
  | {
      payload: number; // index of the field to delete within the visible fields list
      type: typeof BuilderStateAction.DELETE_AGGREGATE;
    }
  | {
      payload: AxisRange | undefined;
      type: typeof BuilderStateAction.SET_AXIS_RANGE;
    }
  | {payload: string | undefined; type: typeof BuilderStateAction.SET_TEXT_CONTENT};
type WidgetBuilderStateActionOptions = {
  updateUrl?: boolean;
};

export interface WidgetBuilderState {
  axisRange?: AxisRange;
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  /**
   * Fields/columns used by the widget. Usage varies by display type:
   * - Table: all columns (both plain fields and aggregates)
   * - Big Number: aggregate fields
   * - Line, Area, Bar (Time Series): grouping fields (non-aggregates)
   * - Bar (Categorical): one X-axis (FIELD kind) and one or more aggregates (FUNCTION/EQUATION kind)
   */
  fields?: Column[];
  legendAlias?: string[];
  legendType?: LegendType;
  limit?: number;
  linkedDashboards?: LinkedDashboard[];
  query?: string[];
  selectedAggregate?: number;
  sort?: Sort[];
  textContent?: string;
  thresholds?: ThresholdsConfig | null;
  title?: string;
  /**
   * Y-axis aggregates for time-series charts (area, bar, line).
   * Not used by tables, big numbers, or categorical bar widgets.
   */
  yAxis?: Column[];
}

/**
 * Generate the sort field string for an aggregate at the given index.
 * Equations use the alias format (equation[N]) where N is the equation's
 * position among all equations in the list (not its overall index).
 * Regular aggregates use generateFieldAsString.
 */
function generateSortField(aggregates: Column[], aggregateIndex: number): string {
  const target = aggregates[aggregateIndex]!;
  const equationIndex =
    aggregates
      .slice(0, aggregateIndex + 1)
      .filter(f => f.kind === FieldValueKind.EQUATION).length - 1;
  return target.kind === FieldValueKind.EQUATION
    ? `equation[${Math.max(0, equationIndex)}]`
    : generateFieldAsString(target);
}

/**
 * Validate the current sort against a new set of aggregates for categorical
 * bar charts. Returns the corrected sort if the current sort field is invalid,
 * or null if no change is needed. Falls back to the aggregate at
 * `fallbackIndex` (defaults to the last aggregate). If `xAxisFields` is
 * provided, sorting by an X-axis column is also treated as valid.
 */
function fixupCategoricalBarSort(
  aggregates: Column[],
  sort: Sort[] | undefined,
  fallbackIndex: number | undefined,
  xAxisFields?: Column[]
): Sort[] | null {
  if (aggregates.length === 0) {
    return null;
  }
  // Clamp fallback to a valid index
  const safeIdx =
    fallbackIndex !== undefined && aggregates[fallbackIndex]
      ? fallbackIndex
      : aggregates.length - 1;
  const currentSortField = sort?.[0]?.field;
  if (currentSortField) {
    // Sorting by the X-axis column is always valid
    if (xAxisFields?.some(f => generateFieldAsString(f) === currentSortField)) {
      return null;
    }

    const hasMatchingSort = aggregates.some(
      f => generateFieldAsString(f) === currentSortField
    );
    const equationCount = aggregates.filter(
      f => f.kind === FieldValueKind.EQUATION
    ).length;
    const isSortValid =
      hasMatchingSort ||
      (isEquationAlias(currentSortField) &&
        getEquationAliasIndex(currentSortField) < equationCount);

    if (!isSortValid) {
      return [
        {kind: sort[0]?.kind ?? 'desc', field: generateSortField(aggregates, safeIdx)},
      ];
    }
    return null;
  }
  // No sort exists yet — set default to fallback aggregate
  return [{kind: 'desc', field: generateSortField(aggregates, safeIdx)}];
}

/**
 * Compute the corrected sort for a table widget after a field is removed.
 * Returns the new sort value, or null if no change is needed. Falls back
 * to the first valid sort option, respecting dataset-specific constraints
 * (Issue widgets allow external sorts, Release widgets have a deny list).
 */
function fixupTableSortOnRemoval(
  newFields: Column[],
  sort: Sort[] | undefined,
  dataset: WidgetType | undefined
): Sort[] | null {
  if (
    newFields.length === 0 ||
    newFields.some(f => generateFieldAsString(f) === sort?.[0]?.field) ||
    dataset === WidgetType.ISSUE
  ) {
    return null;
  }
  let validSortOptions: QueryFieldValue[] = [];
  const firstNotEquation = newFields.find(f => f.kind !== FieldValueKind.EQUATION);
  if (dataset === WidgetType.RELEASE) {
    validSortOptions = newFields.filter(f => {
      const fs = generateFieldAsString(f);
      return !DISABLED_SORT.includes(fs) && !TAG_SORT_DENY_LIST.includes(fs);
    });
  } else if (firstNotEquation) {
    validSortOptions = [firstNotEquation];
  }
  return validSortOptions.length > 0
    ? [{kind: 'desc', field: generateFieldAsString(validSortOptions[0]!)}]
    : [];
}


/**
 * Pure reducer that computes state transitions atomically.
 * Each case returns a complete new state — no stale closures, no multi-setter
 * coordination. The URL sync layer (in the hook) is responsible for
 * persisting state changes.
 *
 * `textContent` lives in session storage and is merged in by the hook;
 * the reducer never reads or writes it.
 */
function widgetBuilderReducer(
  state: WidgetBuilderState,
  action: WidgetAction
): WidgetBuilderState {
  switch (action.type) {
    case BuilderStateAction.SET_TITLE:
      return {...state, title: action.payload};

    case BuilderStateAction.SET_DESCRIPTION:
      return {...state, description: action.payload};

    case BuilderStateAction.SET_DISPLAY_TYPE: {
      const currentDatasetConfig = getDatasetConfig(state.dataset);
      const [aggregates, columns] = partition(state.fields, field => {
        if (field.kind === FieldValueKind.EQUATION) {
          return true;
        }
        const fieldString = generateFieldAsString(field);
        return isAggregateFieldOrEquation(fieldString);
      });
      const columnsWithoutAlias = columns.map(column => ({
        ...column,
        alias: undefined,
      }));
      const aggregatesWithoutAlias = aggregates.map(aggregate => ({
        ...aggregate,
        alias: undefined,
      }));
      const yAxisWithoutAlias = state.yAxis?.map(axis => ({...axis, alias: undefined}));

      let next: WidgetBuilderState = {
        ...state,
        displayType: action.payload,
        selectedAggregate: undefined,
        linkedDashboards: [],
      };

      if (action.payload === DisplayType.TABLE) {
        let newFields: Column[];
        if (state.displayType === DisplayType.DETAILS) {
          newFields =
            currentDatasetConfig.defaultWidgetQuery.fields?.map(field =>
              explodeField({field})
            ) ?? [];
        } else {
          newFields = [
            ...columnsWithoutAlias,
            ...aggregatesWithoutAlias,
            ...(yAxisWithoutAlias ?? []),
          ];
        }

        let newSort = state.sort;
        if (
          newFields.length > 0 &&
          !newFields.some(
            field => generateFieldAsString(field) === state.sort?.[0]?.field
          )
        ) {
          const validReleaseSortOptions = newFields.filter(field => {
            const fieldString = generateFieldAsString(field);
            return (
              !DISABLED_SORT.includes(fieldString) &&
              !TAG_SORT_DENY_LIST.includes(fieldString)
            );
          });

          newSort =
            state.dataset === WidgetType.RELEASE
              ? validReleaseSortOptions.length > 0
                ? [
                    {
                      kind: 'desc',
                      field: generateFieldAsString(validReleaseSortOptions[0]!),
                    },
                  ]
                : []
              : [{kind: 'desc', field: generateFieldAsString(newFields[0]!)}];
        }

        next = {
          ...next,
          fields: newFields,
          yAxis: [],
          sort: newSort,
          limit: undefined,
          legendAlias: [],
        };
      } else if (action.payload === DisplayType.BIG_NUMBER) {
        next = {
          ...next,
          fields: [...aggregatesWithoutAlias, ...(yAxisWithoutAlias ?? [])],
          yAxis: [],
          sort: [],
          limit: undefined,
          legendAlias: [],
          query: state.query?.slice(0, 1),
        };
      } else if (action.payload === DisplayType.DETAILS) {
        next = {
          ...next,
          fields: DETAIL_WIDGET_FIELDS.map(field => ({
            field,
            kind: FieldValueKind.FIELD,
          })),
          yAxis: [],
          sort: [],
          limit: 1,
          legendAlias: [],
          query: state.query?.slice(0, 1),
        };
      } else if (action.payload === DisplayType.CATEGORICAL_BAR) {
        const nextAggregates = [
          ...aggregatesWithoutAlias,
          ...(yAxisWithoutAlias ?? []),
        ];
        if (nextAggregates.length === 0) {
          nextAggregates.push({
            ...currentDatasetConfig.defaultField,
            alias: undefined,
          });
        }

        const nextColumns = [...columnsWithoutAlias.slice(0, 1)];
        if (nextColumns.length === 0 && currentDatasetConfig.defaultCategoryField) {
          nextColumns.push({
            kind: FieldValueKind.FIELD,
            field: currentDatasetConfig.defaultCategoryField,
            alias: undefined,
          });
        }

        let newSort: Sort[] = [];
        if (nextAggregates.length > 0) {
          const sortField = generateSortField(
            nextAggregates,
            nextAggregates.length - 1
          );
          newSort = [{kind: 'desc', field: sortField}];
        }

        next = {
          ...next,
          fields: [...nextColumns, ...nextAggregates],
          yAxis: [],
          sort: newSort,
          legendAlias: [],
          query: state.query?.slice(0, 1),
          limit: DEFAULT_CATEGORICAL_BAR_LIMIT,
        };
      } else if (action.payload === DisplayType.TEXT) {
        next = {
          ...next,
          description: undefined,
          fields: [],
          yAxis: [],
          query: [''],
          sort: [],
          limit: undefined,
          legendAlias: [],
          dataset: undefined,
          linkedDashboards: [],
          thresholds: undefined,
          axisRange: undefined,
          selectedAggregate: undefined,
        };
      } else {
        // Time series (LINE, AREA, BAR, TOP_N)
        const nextAggregates = [
          ...aggregatesWithoutAlias.slice(0, MAX_NUM_Y_AXES),
          ...(yAxisWithoutAlias?.slice(0, MAX_NUM_Y_AXES) ?? []),
        ];
        if (nextAggregates.length === 0) {
          nextAggregates.push({
            ...currentDatasetConfig.defaultField,
            alias: undefined,
          });
        }

        const maxLimit = getResultsLimit(
          state.query?.length ?? 1,
          nextAggregates.length
        );

        let newSort = state.sort;
        if (
          state.dataset === WidgetType.RELEASE &&
          (state.sort?.length ?? 0) === 0
        ) {
          newSort = decodeSorts(
            getDatasetConfig(WidgetType.RELEASE).defaultWidgetQuery.orderby
          );
        }

        next = {
          ...next,
          fields: columnsWithoutAlias,
          yAxis: nextAggregates,
          sort: newSort,
          limit: Math.min(state.limit ?? DEFAULT_RESULTS_LIMIT, maxLimit),
        };
      }

      if (!doesDisplayTypeSupportThresholds(action.payload)) {
        next = {...next, thresholds: undefined};
      }
      if (!usesTimeSeriesData(action.payload)) {
        next = {...next, axisRange: undefined, legendType: undefined};
      }

      return next;
    }

    case BuilderStateAction.SET_DATASET: {
      const config = getDatasetConfig(action.payload);

      let nextDisplayType = state.displayType;
      if (action.payload === WidgetType.ISSUE) {
        nextDisplayType = DisplayType.TABLE;
      } else if (
        nextDisplayType &&
        !config.supportedDisplayTypes.includes(nextDisplayType) &&
        config.supportedDisplayTypes.length > 0
      ) {
        nextDisplayType = config.supportedDisplayTypes[0];
      }

      let next: WidgetBuilderState = {
        ...state,
        dataset: action.payload,
        displayType: nextDisplayType,
        thresholds: undefined,
        axisRange: undefined,
        legendType: undefined,
        query: [config.defaultWidgetQuery.conditions],
        legendAlias: [],
        selectedAggregate: undefined,
        linkedDashboards: [],
      };

      if (nextDisplayType === DisplayType.CATEGORICAL_BAR) {
        const categoricalBarFields: Column[] = [];
        if (config.defaultCategoryField) {
          categoricalBarFields.push({
            kind: FieldValueKind.FIELD,
            field: config.defaultCategoryField,
          });
        }
        if (config.defaultField) {
          categoricalBarFields.push({
            ...config.defaultField,
            alias: undefined,
          });
        }

        const aggregateField = categoricalBarFields.find(
          f => f.kind === FieldValueKind.FUNCTION
        );

        next = {
          ...next,
          yAxis: [],
          fields: categoricalBarFields,
          sort: aggregateField
            ? [{kind: 'desc', field: generateFieldAsString(aggregateField)}]
            : [],
          limit: DEFAULT_CATEGORICAL_BAR_LIMIT,
        };
      } else if (usesTimeSeriesData(nextDisplayType)) {
        next = {
          ...next,
          fields: [],
          yAxis:
            config.defaultWidgetQuery.aggregates?.map(aggregate =>
              explodeField({field: aggregate})
            ),
          sort: decodeSorts(config.defaultWidgetQuery.orderby),
          limit: undefined,
        };
      } else {
        next = {
          ...next,
          yAxis: [],
          fields: config.defaultWidgetQuery.fields?.map(field =>
            explodeField({field})
          ),
          sort:
            nextDisplayType === DisplayType.BIG_NUMBER
              ? []
              : decodeSorts(config.defaultWidgetQuery.orderby),
          limit: undefined,
        };
      }

      return next;
    }

    case BuilderStateAction.SET_FIELDS: {
      let next: WidgetBuilderState = {
        ...state,
        fields: action.payload,
      };

      // Clean up linked dashboards
      const remainingKindFields = action.payload.filter(
        field => field.kind === FieldValueKind.FIELD
      );
      next.linkedDashboards = state.linkedDashboards?.filter(linkedDashboard =>
        remainingKindFields.some(field => field.field === linkedDashboard.field)
      );

      const isRemoved = action.payload.length < (state.fields?.length ?? 0);
      if (
        state.displayType === DisplayType.TABLE &&
        action.payload.length > 0 &&
        !action.payload.some(
          field => generateFieldAsString(field) === state.sort?.[0]?.field
        )
      ) {
        if (state.dataset === WidgetType.ISSUE) {
          // Issue widgets can sort their tables by limited fields that aren't
          // in the fields array.
          // Reset legend breakdown when more than one column is selected
          if (action.payload.length > 1 && state.legendType === 'breakdown') {
            next = {...next, legendType: undefined};
          }
          return next;
        }

        if (isRemoved) {
          const fixedSort = fixupTableSortOnRemoval(
            action.payload,
            state.sort,
            state.dataset
          );
          if (fixedSort) {
            next = {...next, sort: fixedSort};
          }
        } else {
          const firstActionPayloadNotEquation: QueryFieldValue | undefined =
            action.payload.find(field => field.kind !== FieldValueKind.EQUATION);

          let validSortOptions: QueryFieldValue[] = firstActionPayloadNotEquation
            ? [firstActionPayloadNotEquation]
            : [];
          if (state.dataset === WidgetType.RELEASE) {
            validSortOptions = [
              ...action.payload.filter(field => {
                const fieldString = generateFieldAsString(field);
                return (
                  !DISABLED_SORT.includes(fieldString) &&
                  !TAG_SORT_DENY_LIST.includes(fieldString)
                );
              }),
            ];
          }
          const changedFieldIndex = action.payload.findIndex(
            field =>
              !state.fields?.find(
                originalField =>
                  generateFieldAsString(originalField) ===
                    generateFieldAsString(field) ||
                  originalField.kind === FieldValueKind.EQUATION ||
                  (state.dataset === WidgetType.RELEASE &&
                    (DISABLED_SORT.includes(generateFieldAsString(field)) ||
                      TAG_SORT_DENY_LIST.includes(generateFieldAsString(field))))
              )
          );
          if (changedFieldIndex === -1) {
            next = {
              ...next,
              sort:
                validSortOptions.length > 0
                  ? [
                      {
                        kind: state.sort?.[0]?.kind ?? 'desc',
                        field: generateFieldAsString(validSortOptions[0]!),
                      },
                    ]
                  : [],
            };
          } else {
            next = {
              ...next,
              sort: [
                {
                  kind: state.sort?.[0]?.kind ?? 'desc',
                  field: generateFieldAsString(action.payload[changedFieldIndex]!),
                },
              ],
            };
          }
        }
      }

      if (
        state.displayType !== DisplayType.TABLE &&
        state.displayType !== DisplayType.BIG_NUMBER &&
        action.payload.length > 0
      ) {
        const firstYAxisNotEquation = state.yAxis?.find(
          field => field.kind !== FieldValueKind.EQUATION
        );
        const firstActionPayloadNotEquation = action.payload.find(
          field => field.kind !== FieldValueKind.EQUATION
        );

        let sortField: string | undefined;
        if (firstYAxisNotEquation) {
          sortField = generateFieldAsString(firstYAxisNotEquation);
        } else if (firstActionPayloadNotEquation) {
          sortField = generateFieldAsString(firstActionPayloadNotEquation);
        }

        if (sortField) {
          next = {
            ...next,
            sort: [{kind: 'desc', field: sortField}],
          };
        }
      }

      if (
        action.payload.length > 0 &&
        (state.yAxis?.length ?? 0) > 0 &&
        !defined(state.limit)
      ) {
        next = {
          ...next,
          limit: Math.min(
            DEFAULT_RESULTS_LIMIT,
            getResultsLimit(state.query?.length ?? 1, state.yAxis?.length ?? 0)
          ),
        };
      }

      // Reset legend breakdown when more than one column is selected
      if (action.payload.length > 1 && state.legendType === 'breakdown') {
        next = {...next, legendType: undefined};
      }

      return next;
    }

    case BuilderStateAction.SET_Y_AXIS: {
      let next: WidgetBuilderState = {
        ...state,
        yAxis: action.payload,
      };

      if (state.fields?.length && state.fields.length > 0) {
        const maxLimit = getResultsLimit(
          state.query?.length ?? 1,
          action.payload.length
        );
        if (state.limit && state.limit > maxLimit) {
          next = {...next, limit: maxLimit};
        }
      }

      if (action.payload.length > 0 && (!state.fields || state.fields.length === 0)) {
        next = {...next, sort: []};
      } else if (
        action.payload.length > 0 &&
        state.dataset === WidgetType.TRACEMETRICS &&
        state.sort?.length &&
        !checkTraceMetricSortUsed(state.sort, action.payload, state.fields)
      ) {
        next = {
          ...next,
          sort: [
            {
              kind: 'desc',
              field: generateSortField(action.payload, 0),
            },
          ],
        };
      }

      return next;
    }

    case BuilderStateAction.SET_QUERY:
      return {...state, query: action.payload};

    case BuilderStateAction.SET_SORT: {
      if (state.dataset === WidgetType.ISSUE) {
        return {
          ...state,
          sort: action.payload.map(
            ({field}): Sort => ({
              field,
              kind: REVERSED_ORDER_FIELD_SORT_LIST.includes(field) ? 'desc' : 'asc',
            })
          ),
        };
      }
      return {...state, sort: action.payload};
    }

    case BuilderStateAction.SET_LINKED_DASHBOARDS:
      if (
        state.displayType === DisplayType.TABLE ||
        state.legendType === 'breakdown'
      ) {
        return {...state, linkedDashboards: action.payload};
      }
      return {...state, linkedDashboards: []};

    case BuilderStateAction.SET_LIMIT:
      return {...state, limit: action.payload};

    case BuilderStateAction.SET_LEGEND_ALIAS:
      return {...state, legendAlias: action.payload};

    case BuilderStateAction.SET_LEGEND_TYPE: {
      let next: WidgetBuilderState = {...state, legendType: action.payload};
      if (
        action.payload !== 'breakdown' &&
        state.displayType !== DisplayType.TABLE
      ) {
        next = {...next, linkedDashboards: []};
      }
      return next;
    }

    case BuilderStateAction.SET_SELECTED_AGGREGATE: {
      let next: WidgetBuilderState = {
        ...state,
        selectedAggregate: action.payload,
      };

      if (
        state.displayType === DisplayType.CATEGORICAL_BAR &&
        action.payload !== undefined &&
        state.fields
      ) {
        const aggregates = state.fields.filter(
          f =>
            f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
        );
        if (aggregates[action.payload]) {
          next = {
            ...next,
            sort: [
              {
                kind: state.sort?.[0]?.kind ?? 'desc',
                field: generateSortField(aggregates, action.payload),
              },
            ],
          };
        }
      }

      return next;
    }

    case BuilderStateAction.SET_STATE: {
      const p = action.payload;
      return {
        ...state,
        dataset: p.dataset,
        displayType: p.displayType,
        description:
          p.displayType === DisplayType.TEXT ? undefined : p.description,
        fields: p.field ? deserializeFields(p.field) : state.fields,
        legendAlias: p.legendAlias,
        legendType: p.legendType,
        limit: p.limit,
        query: p.query,
        selectedAggregate: p.selectedAggregate,
        sort: decodeSorts(p.sort),
        title: p.title,
        yAxis: p.yAxis ? deserializeFields(p.yAxis) : state.yAxis,
        axisRange: getAxisRange(p.axisRange),
        linkedDashboards: p.linkedDashboards
          ? deserializeLinkedDashboards(p.linkedDashboards)
          : state.linkedDashboards,
      };
    }

    case BuilderStateAction.SET_THRESHOLDS:
      return {...state, thresholds: action.payload};

    case BuilderStateAction.SET_AXIS_RANGE:
      return {...state, axisRange: action.payload};

    case BuilderStateAction.SET_CATEGORICAL_X_AXIS: {
      if (state.displayType !== DisplayType.CATEGORICAL_BAR) {
        return state;
      }

      const existingAggregates =
        state.fields?.filter(
          f =>
            f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
        ) ?? [];
      const newXAxisField: Column = {
        kind: FieldValueKind.FIELD,
        field: action.payload,
      };
      const newCategoricalFields = [newXAxisField, ...existingAggregates];

      let next: WidgetBuilderState = {
        ...state,
        fields: newCategoricalFields,
      };

      if (existingAggregates.length > 0) {
        const fixedSort = fixupCategoricalBarSort(
          existingAggregates,
          state.sort,
          state.selectedAggregate,
          [newXAxisField]
        );
        if (fixedSort) {
          next = {...next, sort: fixedSort};
        }
      } else {
        next = {...next, sort: []};
      }

      return next;
    }

    case BuilderStateAction.SET_CATEGORICAL_AGGREGATE: {
      if (state.displayType !== DisplayType.CATEGORICAL_BAR) {
        return state;
      }

      const existingXAxisFields =
        state.fields?.filter(f => f.kind === FieldValueKind.FIELD) ?? [];

      let next: WidgetBuilderState = {
        ...state,
        fields: [...existingXAxisFields, ...action.payload],
      };

      const oldAggregates =
        state.fields?.filter(
          f =>
            f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
        ) ?? [];
      const sortedOldIndex = oldAggregates.findIndex(
        f => generateFieldAsString(f) === state.sort?.[0]?.field
      );

      const fixedSort = fixupCategoricalBarSort(
        action.payload,
        state.sort,
        sortedOldIndex >= 0 ? sortedOldIndex : undefined,
        existingXAxisFields
      );
      if (fixedSort) {
        next = {...next, sort: fixedSort};
      }

      return next;
    }

    case BuilderStateAction.DELETE_AGGREGATE: {
      const deleteIndex = action.payload;

      let next: WidgetBuilderState = {...state};

      if (state.displayType === DisplayType.CATEGORICAL_BAR) {
        const xAxisFields =
          state.fields?.filter(f => f.kind === FieldValueKind.FIELD) ?? [];
        const aggregates =
          state.fields?.filter(
            f =>
              f.kind === FieldValueKind.FUNCTION ||
              f.kind === FieldValueKind.EQUATION
          ) ?? [];
        const newAggregates = aggregates.filter((_, i) => i !== deleteIndex);

        next = {...next, fields: [...xAxisFields, ...newAggregates]};

        const fixedSort = fixupCategoricalBarSort(
          newAggregates,
          state.sort,
          undefined,
          xAxisFields
        );
        if (fixedSort) {
          next = {...next, sort: fixedSort};
        }
      } else if (state.displayType === DisplayType.BIG_NUMBER) {
        const newFields = state.fields?.filter((_, i) => i !== deleteIndex) ?? [];
        next = {...next, fields: newFields};
      } else if (
        state.displayType === DisplayType.LINE ||
        state.displayType === DisplayType.AREA ||
        state.displayType === DisplayType.BAR ||
        state.displayType === DisplayType.TOP_N
      ) {
        const newYAxis = state.yAxis?.filter((_, i) => i !== deleteIndex) ?? [];
        next = {...next, yAxis: newYAxis};

        if (state.fields?.length && state.fields.length > 0) {
          const maxLimit = getResultsLimit(
            state.query?.length ?? 1,
            newYAxis.length
          );
          if (state.limit && state.limit > maxLimit) {
            next = {...next, limit: maxLimit};
          }
        }

        if (newYAxis.length > 0 && (!state.fields || state.fields.length === 0)) {
          next = {...next, sort: []};
        } else if (
          newYAxis.length > 0 &&
          state.dataset === WidgetType.TRACEMETRICS &&
          state.sort?.length &&
          !checkTraceMetricSortUsed(state.sort, newYAxis, state.fields)
        ) {
          next = {
            ...next,
            sort: [
              {kind: 'desc', field: generateFieldAsString(newYAxis[0]!)},
            ],
          };
        }
      } else {
        // Table / other
        const newFields = state.fields?.filter((_, i) => i !== deleteIndex) ?? [];
        next = {...next, fields: newFields};

        const remainingKindFields = newFields.filter(
          f => f.kind === FieldValueKind.FIELD
        );
        next.linkedDashboards = state.linkedDashboards?.filter(ld =>
          remainingKindFields.some(f => f.field === ld.field)
        );

        if (state.displayType === DisplayType.TABLE) {
          const fixedSort = fixupTableSortOnRemoval(
            newFields,
            state.sort,
            state.dataset
          );
          if (fixedSort) {
            next = {...next, sort: fixedSort};
          }
        }
      }

      // Adjust selectedAggregate index for Big Number and Categorical Bar
      if (
        (state.displayType === DisplayType.BIG_NUMBER ||
          state.displayType === DisplayType.CATEGORICAL_BAR) &&
        state.selectedAggregate !== undefined
      ) {
        if (deleteIndex < state.selectedAggregate) {
          next = {...next, selectedAggregate: state.selectedAggregate - 1};
        } else if (deleteIndex === state.selectedAggregate) {
          next = {...next, selectedAggregate: undefined};
        }
      }

      return next;
    }

    case BuilderStateAction.SET_TEXT_CONTENT:
      // textContent is managed via session storage in the hook, not in reducer state.
      // Return state unchanged; the hook wrapper handles this action.
      return state;

    default:
      return state;
  }
}


const WIDGET_BUILDER_URL_PARAMS = new Set([
  'title',
  'description',
  'displayType',
  'dataset',
  'field',
  'yAxis',
  'query',
  'sort',
  'limit',
  'legendAlias',
  'legendType',
  'selectedAggregate',
  'thresholds',
  'linkedDashboards',
  'axisRange',
]);

/**
 * Deserialize URL query params into WidgetBuilderState.
 */
function deserializeUrlToState(
  queryParams: Record<string, any>
): WidgetBuilderState {
  const title = decodeScalar(queryParams.title, '') ?? undefined;
  const description = decodeScalar(queryParams.description, '') ?? undefined;
  const displayType = deserializeDisplayType(
    decodeScalar(queryParams.displayType, '') ?? ''
  );
  const dataset = deserializeDataset(
    decodeScalar(queryParams.dataset, '') ?? ''
  );
  const fields = queryParams.field
    ? deserializeFields(decodeList(queryParams.field))
    : undefined;
  const yAxis = queryParams.yAxis
    ? deserializeFields(decodeList(queryParams.yAxis))
    : undefined;
  const query = deserializeQuery(decodeList(queryParams.query));
  const sort = deserializeSorts(dataset)(decodeSorts(queryParams.sort));
  const decodedLimit = decodeScalar(queryParams.limit, '');
  const limit = defined(decodedLimit) ? deserializeLimit(decodedLimit) : undefined;
  const legendAlias = queryParams.legendAlias
    ? decodeList(queryParams.legendAlias)
    : undefined;
  const legendType = queryParams.legendType
    ? deserializeLegendType(decodeScalar(queryParams.legendType, '') ?? '')
    : undefined;
  const selectedAggregate = queryParams.selectedAggregate
    ? deserializeSelectedAggregate(
        decodeScalar(queryParams.selectedAggregate, '') ?? ''
      )
    : undefined;
  const thresholds = queryParams.thresholds
    ? deserializeThresholds(decodeScalar(queryParams.thresholds, '') ?? '')
    : undefined;
  const linkedDashboards = queryParams.linkedDashboards
    ? deserializeLinkedDashboards(decodeList(queryParams.linkedDashboards))
    : undefined;
  const axisRange = queryParams.axisRange
    ? getAxisRange(decodeScalar(queryParams.axisRange, '') ?? '')
    : undefined;

  return {
    title,
    description,
    displayType,
    dataset,
    fields,
    yAxis,
    query,
    sort,
    limit,
    legendAlias,
    legendType,
    selectedAggregate,
    thresholds,
    linkedDashboards,
    axisRange,
  };
}

/**
 * Serialize WidgetBuilderState to URL query params.
 * Returns only widget builder params; non-widget params are preserved separately.
 */
function serializeStateToUrl(
  state: WidgetBuilderState
): Record<string, string | string[] | number | undefined> {
  return {
    title: state.title,
    description: state.description,
    displayType: state.displayType,
    dataset: state.dataset,
    field: serializeFields(state.fields ?? []),
    yAxis: serializeFields(state.yAxis ?? []),
    query: state.query,
    sort: serializeSorts(state.dataset)(state.sort ?? []),
    limit: state.limit,
    legendAlias: state.legendAlias,
    legendType: state.legendType,
    selectedAggregate: state.selectedAggregate,
    thresholds: state.thresholds ? serializeThresholds(state.thresholds) : undefined,
    linkedDashboards: state.linkedDashboards
      ? serializeLinkedDashboards(state.linkedDashboards)
      : undefined,
    axisRange: state.axisRange,
  };
}


export function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction, options?: WidgetBuilderStateActionOptions) => void;
  state: WidgetBuilderState;
} {
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize reducer state from URL on mount only
  const [initialState] = useState(() => deserializeUrlToState(location.query));
  const [reducerState, rawDispatch] = useReducer(widgetBuilderReducer, initialState);

  // textContent lives in session storage, not the URL
  const [textContent, setTextContent] = useSessionStorage<string | undefined>(
    WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP.textContent.key,
    undefined
  );

  // Skip the initial mount (state already matches URL)
  const isInitialRenderRef = useRef(true);
  // Track whether the next effect should sync to URL
  const shouldSyncUrlRef = useRef(true);

  // Merge textContent and compute derived selectedAggregate
  const state = useMemo(() => {
    const {displayType, fields, selectedAggregate: rawSelected} = reducerState;
    let selectedAggregate: number | undefined;

    if (
      displayType === DisplayType.BIG_NUMBER &&
      defined(fields) &&
      fields.length > 1
    ) {
      selectedAggregate = rawSelected ?? fields.length - 1;
    } else if (
      displayType === DisplayType.CATEGORICAL_BAR &&
      defined(fields)
    ) {
      const aggregateCount = fields.filter(
        f =>
          f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
      ).length;
      selectedAggregate =
        aggregateCount > 1
          ? Math.min(rawSelected ?? aggregateCount - 1, aggregateCount - 1)
          : undefined;
    }

    return {
      ...reducerState,
      textContent,
      selectedAggregate,
    };
  }, [reducerState, textContent]);

  // Wrapped dispatch
  const dispatch = useCallback(
    (action: WidgetAction, options?: WidgetBuilderStateActionOptions) => {
      shouldSyncUrlRef.current = options?.updateUrl !== false;

      // Handle textContent side effects
      if (action.type === BuilderStateAction.SET_TEXT_CONTENT) {
        setTextContent(action.payload);
        // Don't sync URL for text content changes
        shouldSyncUrlRef.current = false;
        rawDispatch(action);
        return;
      }

      if (action.type === BuilderStateAction.SET_DISPLAY_TYPE) {
        if (
          reducerState.displayType === DisplayType.TEXT &&
          action.payload !== DisplayType.TEXT
        ) {
          setTextContent(undefined);
        } else if (action.payload === DisplayType.TEXT) {
          setTextContent(reducerState.description ?? '');
        }
      }

      if (action.type === BuilderStateAction.SET_STATE) {
        if (action.payload.displayType === DisplayType.TEXT) {
          setTextContent(action.payload.textContent);
        } else {
          setTextContent(undefined);
        }
      }

      rawDispatch(action);
    },
    [rawDispatch, setTextContent, reducerState.displayType, reducerState.description]
  );

  // Debounced URL writer — collapses rapid-fire dispatches (e.g. typing)
  // into a single navigate call, matching the old UrlParamBatchProvider behavior.
  const flushToUrl = useMemo(
    () =>
      debounce((nextState: WidgetBuilderState) => {
        const serialized = serializeStateToUrl(nextState);

        const existingParams = qs.parse(window.location.search);
        const nonWidgetParams: Record<
          string,
          string | string[] | null | undefined
        > = {};
        for (const [key, value] of Object.entries(existingParams)) {
          if (!WIDGET_BUILDER_URL_PARAMS.has(key)) {
            nonWidgetParams[key] = value;
          }
        }

        navigate(
          {
            pathname: window.location.pathname,
            query: {
              ...nonWidgetParams,
              ...serialized,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      }, URL_SYNC_DEBOUNCE_MS),
    [navigate]
  );

  // Cancel pending URL writes on unmount
  useEffect(() => () => flushToUrl.cancel(), [flushToUrl]);

  // URL sync effect: schedule a debounced URL write when reducer state changes
  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }
    if (!shouldSyncUrlRef.current) {
      shouldSyncUrlRef.current = true;
      return;
    }

    flushToUrl(reducerState);
  }, [reducerState, flushToUrl]);

  return {state, dispatch};
}


/**
 * Decodes the display type from the query params
 * Returns the default display type if the value is not a valid display type
 */
function deserializeDisplayType(value: string): DisplayType {
  if (value === DisplayType.TOP_N) {
    return DisplayType.AREA;
  }
  if (Object.values(DisplayType).includes(value as DisplayType)) {
    return value as DisplayType;
  }
  return DisplayType.TABLE;
}

/**
 * Decodes the dataset from the query params
 * Returns the default dataset if the value is not a valid dataset
 */
function deserializeDataset(value: string): WidgetType {
  if (Object.values(WidgetType).includes(value as WidgetType)) {
    return value as WidgetType;
  }
  return WidgetType.ERRORS;
}

/**
 * Takes fields from the query params in list form and converts
 * them into a list of fields and functions
 */
function deserializeFields(fields: string[]): Column[] {
  return fields.map(stringifiedField => {
    try {
      const {field, alias} = JSON.parse(stringifiedField);
      return explodeField({field, alias});
    } catch (error) {
      return explodeField({field: stringifiedField, alias: undefined});
    }
  });
}

/**
 * Takes fields in the field and function format and coverts
 * them into a list of strings compatible with query params
 */
export function serializeFields(fields: Column[]): string[] {
  return fields.map(field => {
    if (field.alias) {
      return JSON.stringify({
        field: generateFieldAsString(field),
        alias: field.alias,
      });
    }
    return generateFieldAsString(field);
  });
}

export function serializeLinkedDashboards(
  linkedDashboards: LinkedDashboard[] = []
): string[] {
  return linkedDashboards.map(linkedDashboard => {
    return JSON.stringify({
      dashboardId: linkedDashboard.dashboardId,
      field: linkedDashboard.field,
    } satisfies LinkedDashboard);
  });
}

function deserializeLinkedDashboards(linkedDashboards: string[]): LinkedDashboard[] {
  return linkedDashboards
    .map(linkedDashboard => {
      const maybeLinkedDashboard = JSON.parse(linkedDashboard);
      if (maybeLinkedDashboard.dashboardId && maybeLinkedDashboard.field) {
        return {
          dashboardId: maybeLinkedDashboard.dashboardId,
          field: maybeLinkedDashboard.field,
        } satisfies LinkedDashboard;
      }
      return;
    })
    .filter(defined);
}

export function serializeSorts(dataset?: WidgetType) {
  return function (sorts: Sort[]): string[] {
    return sorts.map(sort => {
      // All issue fields do not use '-' regardless of order
      if (dataset === WidgetType.ISSUE) {
        return sort.field;
      }
      const direction = sort.kind === 'desc' ? '-' : '';
      return `${direction}${sort.field}`;
    });
  };
}

function deserializeSorts(dataset?: WidgetType) {
  return function (sorts: Sort[]): Sort[] {
    return sorts.map(sort => {
      if (
        dataset === WidgetType.ISSUE &&
        REVERSED_ORDER_FIELD_SORT_LIST.includes(sort.field)
      ) {
        return {
          field: sort.field,
          kind: 'desc',
        };
      }
      return sort;
    });
  };
}

/**
 * Decodes the limit from the query params
 * Returns the default limit if the value is not a valid limit
 */
function deserializeLimit(value: string): number {
  return decodeInteger(value, DEFAULT_RESULTS_LIMIT);
}

function deserializeSelectedAggregate(value: string): number | undefined {
  return decodeInteger(value);
}

const VALID_LEGEND_TYPES: LegendType[] = ['default', 'breakdown'];

function deserializeLegendType(value: string): LegendType | undefined {
  if (VALID_LEGEND_TYPES.includes(value as LegendType)) {
    return value as LegendType;
  }
  return undefined;
}

/**
 * Decodes the query from the query params
 * Returns an array with an empty string if the query is empty
 */
function deserializeQuery(queries: string[]): string[] {
  if (queries.length === 0) {
    return [''];
  }
  return queries;
}

function deserializeThresholds(value: string): ThresholdsConfig | undefined {
  if (value === '') {
    return undefined;
  }

  return JSON.parse(value);
}

export function serializeThresholds(thresholds: ThresholdsConfig | null): string {
  return JSON.stringify(thresholds);
}

function checkTraceMetricSortUsed(
  sort: Sort[],
  yAxis: Column[] = [],
  fields: Column[] = []
): boolean {
  const sortValue = sort[0]?.field;
  const sortInFields = fields?.some(field => generateFieldAsString(field) === sortValue);
  const sortInYAxis = yAxis?.some(
    (field, i) =>
      generateFieldAsString(field) === sortValue ||
      generateSortField(yAxis, i) === sortValue
  );
  return sortInFields || sortInYAxis;
}
