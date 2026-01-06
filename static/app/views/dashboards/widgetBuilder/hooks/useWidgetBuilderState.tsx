import {useCallback, useMemo} from 'react';
import partition from 'lodash/partition';

import {defined} from 'sentry/utils';
import {
  explodeField,
  generateFieldAsString,
  isAggregateFieldOrEquation,
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
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DisplayType,
  WidgetType,
  type LinkedDashboard,
} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';
import {
  DISABLED_SORT,
  TAG_SORT_DENY_LIST,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {
  DEFAULT_RESULTS_LIMIT,
  getResultsLimit,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import {generateMetricAggregate} from 'sentry/views/dashboards/widgetBuilder/utils/generateMetricAggregate';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
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

export type WidgetBuilderStateQueryParams = {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  field?: string[];
  legendAlias?: string[];
  limit?: number;
  query?: string[];
  selectedAggregate?: number;
  sort?: string[];
  thresholds?: string;
  title?: string;
  traceMetric?: string;
  yAxis?: string[];
};

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
  SET_SELECTED_AGGREGATE: 'SET_SELECTED_AGGREGATE',
  SET_STATE: 'SET_STATE',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
  SET_TRACE_METRIC: 'SET_TRACE_METRIC',
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
  | {payload: number | undefined; type: typeof BuilderStateAction.SET_SELECTED_AGGREGATE}
  | {payload: WidgetBuilderStateQueryParams; type: typeof BuilderStateAction.SET_STATE}
  | {
      payload: ThresholdsConfig | null | undefined;
      type: typeof BuilderStateAction.SET_THRESHOLDS;
    }
  | {
      payload: TraceMetric | undefined;
      type: typeof BuilderStateAction.SET_TRACE_METRIC;
    };
type WidgetBuilderStateActionOptions = {
  updateUrl?: boolean;
};

export interface WidgetBuilderState {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  fields?: Column[];
  legendAlias?: string[];
  limit?: number;
  linkedDashboards?: LinkedDashboard[];
  query?: string[];
  selectedAggregate?: number;
  sort?: Sort[];
  thresholds?: ThresholdsConfig | null;
  title?: string;
  traceMetric?: TraceMetric;
  yAxis?: Column[];
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction, options?: WidgetBuilderStateActionOptions) => void;
  state: WidgetBuilderState;
} {
  const [title, setTitle] = useQueryParamState<string>({fieldName: 'title'});
  const [description, setDescription] = useQueryParamState<string>({
    fieldName: 'description',
  });
  const [displayType, setDisplayType] = useQueryParamState<DisplayType>({
    fieldName: 'displayType',
    deserializer: deserializeDisplayType,
  });
  const [dataset, setDataset] = useQueryParamState<WidgetType>({
    fieldName: 'dataset',
    deserializer: deserializeDataset,
  });
  const [fields, setFields] = useQueryParamState<Column[]>({
    fieldName: 'field',
    decoder: decodeList,
    deserializer: deserializeFields,
    serializer: serializeFields,
  });
  const [yAxis, setYAxis] = useQueryParamState<Column[]>({
    fieldName: 'yAxis',
    decoder: decodeList,
    deserializer: deserializeFields,
    serializer: serializeFields,
  });
  const [query, setQuery] = useQueryParamState<string[]>({
    fieldName: 'query',
    decoder: decodeList,
    deserializer: deserializeQuery,
  });
  const [sort, setSort] = useQueryParamState<Sort[]>({
    fieldName: 'sort',
    decoder: decodeSorts,
    deserializer: deserializeSorts(dataset),
    serializer: serializeSorts(dataset),
  });
  const [limit, setLimit] = useQueryParamState<number>({
    fieldName: 'limit',
    decoder: decodeScalar,
    deserializer: deserializeLimit,
  });
  const [legendAlias, setLegendAlias] = useQueryParamState<string[]>({
    fieldName: 'legendAlias',
    decoder: decodeList,
  });
  const [selectedAggregate, setSelectedAggregate] = useQueryParamState<number>({
    fieldName: 'selectedAggregate',
    decoder: decodeScalar,
    deserializer: deserializeSelectedAggregate,
  });
  const [thresholds, setThresholds] = useQueryParamState<ThresholdsConfig | null>({
    fieldName: 'thresholds',
    decoder: decodeScalar,
    deserializer: deserializeThresholds,
    serializer: serializeThresholds,
  });
  const [linkedDashboards, setLinkedDashboards] = useQueryParamState<LinkedDashboard[]>({
    fieldName: 'linkedDashboards',
    decoder: decodeList,
    deserializer: deserializeLinkedDashboards,
    serializer: serializeLinkedDashboards,
  });
  // TraceMetric widgets only support a single metric at this time. All aggregates
  // must be in reference to this metric.
  const [traceMetric, setTraceMetric] = useQueryParamState<TraceMetric | undefined>({
    fieldName: 'traceMetric',
    decoder: decodeScalar,
    deserializer: deserializeTraceMetric,
    serializer: serializeTraceMetric,
  });

  const state = useMemo(
    () => ({
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
      thresholds,
      linkedDashboards,
      traceMetric,
      // The selected aggregate is the last aggregate for big number widgets
      // if it hasn't been explicitly set
      selectedAggregate:
        displayType === DisplayType.BIG_NUMBER && defined(fields) && fields.length > 1
          ? (selectedAggregate ?? fields.length - 1)
          : undefined,
    }),
    [
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
      selectedAggregate,
      thresholds,
      linkedDashboards,
      traceMetric,
    ]
  );

  const dispatch = useCallback(
    (action: WidgetAction, options?: WidgetBuilderStateActionOptions) => {
      const currentDatasetConfig = getDatasetConfig(dataset);
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload, options);
          break;
        case BuilderStateAction.SET_DESCRIPTION:
          setDescription(action.payload, options);
          break;
        case BuilderStateAction.SET_DISPLAY_TYPE: {
          setDisplayType(action.payload, options);
          const [aggregates, columns] = partition(fields, field => {
            const fieldString = generateFieldAsString(field);
            return isAggregateFieldOrEquation(fieldString);
          });
          const columnsWithoutAlias = columns.map(column => {
            return {...column, alias: undefined};
          });
          const aggregatesWithoutAlias = aggregates.map(aggregate => {
            return {...aggregate, alias: undefined};
          });
          const yAxisWithoutAlias = yAxis?.map(axis => {
            return {...axis, alias: undefined};
          });
          if (action.payload === DisplayType.TABLE) {
            setLinkedDashboards([], options);
            setLimit(undefined, options);
            setYAxis([], options);
            setLegendAlias([], options);
            const newFields = [
              ...columnsWithoutAlias,
              ...aggregatesWithoutAlias,
              ...(yAxisWithoutAlias ?? []),
            ];
            setFields(newFields, options);

            // Keep the sort if it's already contained in the new fields
            // Otherwise, reset sorting to the first field
            if (
              newFields.length > 0 &&
              !newFields.some(field => generateFieldAsString(field) === sort?.[0]?.field)
            ) {
              const validReleaseSortOptions = newFields.filter(field => {
                const fieldString = generateFieldAsString(field);
                return (
                  !DISABLED_SORT.includes(fieldString) &&
                  !TAG_SORT_DENY_LIST.includes(fieldString)
                );
              });

              setSort(
                dataset === WidgetType.RELEASE
                  ? validReleaseSortOptions.length > 0
                    ? [
                        {
                          kind: 'desc',
                          field: generateFieldAsString(
                            validReleaseSortOptions[0] as QueryFieldValue
                          ),
                        },
                      ]
                    : []
                  : [
                      {
                        kind: 'desc',
                        field: generateFieldAsString(newFields[0] as QueryFieldValue),
                      },
                    ],
                options
              );
            }
          } else if (action.payload === DisplayType.BIG_NUMBER) {
            // TODO: Reset the selected aggregate here for widgets with equations
            setLimit(undefined, options);
            setSort([], options);
            setYAxis([], options);
            setLegendAlias([], options);
            // Columns are ignored for big number widgets because there is no grouping
            setFields([...aggregatesWithoutAlias, ...(yAxisWithoutAlias ?? [])], options);
            setQuery(query?.slice(0, 1), options);
          } else if (action.payload === DisplayType.DETAILS) {
            setLimit(1, options);
            setSort([], options);
            setYAxis([], options);
            setLegendAlias([], options);
            setFields(
              DETAIL_WIDGET_FIELDS.map(field => ({field, kind: FieldValueKind.FIELD})),
              options
            );
            setQuery(query?.slice(0, 1), options);
          } else {
            setFields(columnsWithoutAlias, options);
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
            setYAxis(nextAggregates, options);

            // Reset the limit to a valid value, bias towards the current limit or
            // default if possible
            const maxLimit = getResultsLimit(query?.length ?? 1, nextAggregates.length);
            setLimit(Math.min(limit ?? DEFAULT_RESULTS_LIMIT, maxLimit), options);

            if (dataset === WidgetType.RELEASE && sort?.length === 0) {
              setSort(
                decodeSorts(
                  getDatasetConfig(WidgetType.RELEASE).defaultWidgetQuery.orderby
                ),
                options
              );
            }
          }
          setThresholds(undefined, options);
          setSelectedAggregate(undefined, options);
          setLinkedDashboards([], options);
          break;
        }
        case BuilderStateAction.SET_DATASET: {
          setDataset(action.payload, options);

          let nextDisplayType = displayType;
          if (action.payload === WidgetType.ISSUE) {
            // Issues only support table display type
            setDisplayType(DisplayType.TABLE, options);
            nextDisplayType = DisplayType.TABLE;
          }

          const config = getDatasetConfig(action.payload);
          setFields(
            config.defaultWidgetQuery.fields?.map(field => explodeField({field})),
            options
          );
          if (isChartDisplayType(nextDisplayType)) {
            setFields([], options);
            setYAxis(
              config.defaultWidgetQuery.aggregates?.map(aggregate =>
                explodeField({field: aggregate})
              ),
              options
            );
            setSort(decodeSorts(config.defaultWidgetQuery.orderby), options);
          } else {
            setYAxis([], options);
            setFields(
              config.defaultWidgetQuery.fields?.map(field => explodeField({field})),
              options
            );
            setSort(
              nextDisplayType === DisplayType.BIG_NUMBER
                ? []
                : decodeSorts(config.defaultWidgetQuery.orderby),
              options
            );
          }

          setThresholds(undefined, options);
          setQuery([config.defaultWidgetQuery.conditions], options);
          setLegendAlias([], options);
          setSelectedAggregate(undefined, options);
          setLimit(undefined, options);
          setLinkedDashboards([], options);
          break;
        }
        case BuilderStateAction.SET_FIELDS: {
          setFields(action.payload, options);
          const remainingKindFields = action.payload.filter(
            field => field.kind === FieldValueKind.FIELD
          );
          const remainingLinkedDashboards = linkedDashboards?.filter(linkedDashboard =>
            remainingKindFields.some(field => field.field === linkedDashboard.field)
          );
          setLinkedDashboards(remainingLinkedDashboards, options);

          const isRemoved = action.payload.length < (fields?.length ?? 0);
          if (
            displayType === DisplayType.TABLE &&
            action.payload.length > 0 &&
            !action.payload.some(
              field => generateFieldAsString(field) === sort?.[0]?.field
            )
          ) {
            if (dataset === WidgetType.ISSUE) {
              // Issue widgets can sort their tables by limited fields that aren't
              // in the fields array.
              return;
            }

            const firstActionPayloadNotEquation: QueryFieldValue | undefined =
              action.payload.find(field => field.kind !== FieldValueKind.EQUATION);

            let validSortOptions: QueryFieldValue[] = firstActionPayloadNotEquation
              ? [firstActionPayloadNotEquation]
              : [];
            if (dataset === WidgetType.RELEASE) {
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

            if (isRemoved) {
              setSort(
                validSortOptions.length > 0
                  ? [
                      {
                        kind: 'desc',
                        field: generateFieldAsString(
                          validSortOptions[0] as QueryFieldValue
                        ),
                      },
                    ]
                  : [],
                options
              );
            } else {
              // Find the index of the first field that doesn't match the old fields, is not an equation, and is not a disabled release sort option.
              const changedFieldIndex = action.payload.findIndex(
                field =>
                  !fields?.find(
                    originalField =>
                      generateFieldAsString(originalField) ===
                        generateFieldAsString(field) ||
                      originalField.kind === FieldValueKind.EQUATION ||
                      (dataset === WidgetType.RELEASE &&
                        (DISABLED_SORT.includes(generateFieldAsString(field)) ||
                          TAG_SORT_DENY_LIST.includes(generateFieldAsString(field))))
                  )
              );
              if (changedFieldIndex === -1) {
                setSort(
                  validSortOptions.length > 0
                    ? [
                        {
                          kind: sort?.[0]?.kind ?? 'desc',
                          field: generateFieldAsString(
                            validSortOptions[0] as QueryFieldValue
                          ),
                        },
                      ]
                    : [],
                  options
                );
              } else {
                // At this point, we can assume the fields are the same length so
                // using the changedFieldIndex in action.payload is safe.
                setSort(
                  [
                    {
                      kind: sort?.[0]?.kind ?? 'desc',
                      field: generateFieldAsString(
                        action.payload[changedFieldIndex] as QueryFieldValue
                      ),
                    },
                  ],
                  options
                );
              }
            }
          }

          if (
            displayType !== DisplayType.TABLE &&
            displayType !== DisplayType.BIG_NUMBER &&
            action.payload.length > 0
          ) {
            const firstYAxisNotEquation = yAxis?.filter(
              field => field.kind !== FieldValueKind.EQUATION
            )[0];
            const firstActionPayloadNotEquation = action.payload.find(
              field => field.kind !== FieldValueKind.EQUATION
            );
            // Adding a grouping, so default the sort to the first aggregate if possible
            const sortField =
              dataset === WidgetType.TRACEMETRICS
                ? (generateMetricAggregate(
                    traceMetric ?? {name: '', type: ''},
                    firstYAxisNotEquation as QueryFieldValue
                  ) ?? '')
                : (generateFieldAsString(firstYAxisNotEquation as QueryFieldValue) ??
                  generateFieldAsString(
                    firstActionPayloadNotEquation as QueryFieldValue
                  ));
            setSort(
              [
                {
                  kind: 'desc',
                  field: sortField,
                },
              ],
              options
            );
          }

          if (action.payload.length > 0 && (yAxis?.length ?? 0) > 0 && !defined(limit)) {
            setLimit(
              Math.min(
                DEFAULT_RESULTS_LIMIT,
                getResultsLimit(query?.length ?? 1, yAxis?.length ?? 0)
              ),
              options
            );
          }
          break;
        }
        case BuilderStateAction.SET_Y_AXIS:
          setYAxis(action.payload, options);

          if (fields?.length && fields.length > 0) {
            // Check if we need to update the limit for a Top N query
            const maxLimit = getResultsLimit(query?.length ?? 1, action.payload.length);
            if (limit && limit > maxLimit) {
              setLimit(maxLimit, options);
            }
          }

          // If there are yAxis fields but no groupings, clear the sort
          if (action.payload.length > 0 && (!fields || fields.length === 0)) {
            setSort([], options);
          } else if (
            action.payload.length > 0 &&
            dataset === WidgetType.TRACEMETRICS &&
            traceMetric &&
            sort?.length &&
            !checkTraceMetricSortUsed(sort, traceMetric, action.payload, fields)
          ) {
            setSort(
              [
                {
                  kind: 'desc',
                  field: generateMetricAggregate(traceMetric, action.payload[0]!),
                },
              ],
              options
            );
          }
          break;
        case BuilderStateAction.SET_QUERY:
          setQuery(action.payload, options);
          break;
        case BuilderStateAction.SET_SORT: {
          if (dataset === WidgetType.ISSUE) {
            setSort(
              action.payload.map(
                ({field}): Sort => ({
                  field,
                  kind: REVERSED_ORDER_FIELD_SORT_LIST.includes(field) ? 'desc' : 'asc',
                })
              ),
              options
            );
          } else {
            setSort(action.payload, options);
          }
          break;
        }
        case BuilderStateAction.SET_LINKED_DASHBOARDS:
          if (displayType === DisplayType.TABLE) {
            setLinkedDashboards(action.payload, options);
          } else {
            setLinkedDashboards([], options);
          }
          break;
        case BuilderStateAction.SET_LIMIT:
          setLimit(action.payload, options);
          break;
        case BuilderStateAction.SET_LEGEND_ALIAS:
          setLegendAlias(action.payload, options);
          break;
        case BuilderStateAction.SET_SELECTED_AGGREGATE:
          setSelectedAggregate(action.payload, options);
          break;
        case BuilderStateAction.SET_STATE:
          setDataset(action.payload.dataset, options);
          setDescription(action.payload.description, options);
          setDisplayType(action.payload.displayType, options);
          if (action.payload.field) {
            setFields(deserializeFields(action.payload.field), options);
          }
          setLegendAlias(action.payload.legendAlias, options);
          setLimit(action.payload.limit, options);
          setQuery(action.payload.query, options);
          setSelectedAggregate(action.payload.selectedAggregate, options);
          setSort(decodeSorts(action.payload.sort), options);
          setTitle(action.payload.title, options);
          if (action.payload.yAxis) {
            setYAxis(deserializeFields(action.payload.yAxis), options);
          }
          if (action.payload.traceMetric) {
            setTraceMetric(deserializeTraceMetric(action.payload.traceMetric), options);
          }
          break;
        case BuilderStateAction.SET_THRESHOLDS:
          setThresholds(action.payload, options);
          break;
        case BuilderStateAction.SET_TRACE_METRIC:
          if (dataset === WidgetType.TRACEMETRICS) {
            setTraceMetric(action.payload, options);

            if (!action.payload) {
              break;
            }

            // Check the validity of the aggregates against the new trace metric and
            // set fields and sorting accordingly
            let updatedAggregates: Column[] = [];
            const aggregateSource = isChartDisplayType(displayType) ? yAxis : fields;
            const validAggregateOptions = OPTIONS_BY_TYPE[action.payload.type] ?? [];

            if (aggregateSource && validAggregateOptions.length > 0) {
              updatedAggregates = aggregateSource.map(field => {
                if (field.kind === 'function' && field.function?.[0]) {
                  const aggregate = field.function[0];
                  const isValid = validAggregateOptions.some(
                    opt => opt.value === aggregate
                  );

                  if (!isValid) {
                    // Replace with first valid aggregate
                    return {
                      function: [
                        validAggregateOptions[0]?.value ?? '',
                        'value',
                        undefined,
                        undefined,
                      ],
                      alias: undefined,
                      kind: 'function',
                    } as QueryFieldValue;
                  }
                }
                return field;
              });

              // Update the appropriate source
              if (isChartDisplayType(displayType)) {
                setYAxis(updatedAggregates, options);
              } else {
                setFields(updatedAggregates, options);
              }
            }

            // Update the sort if the current sort is not used in
            // any of the current fields
            if (
              sort &&
              sort.length > 0 &&
              !checkTraceMetricSortUsed(
                sort,
                action.payload,
                // Depending on the display type, the updated aggregates can be either
                // the yAxis or the fields
                isChartDisplayType(displayType) ? updatedAggregates : yAxis,
                isChartDisplayType(displayType) ? fields : updatedAggregates
              )
            ) {
              if (updatedAggregates.length > 0) {
                setSort(
                  [
                    {
                      field: generateMetricAggregate(
                        action.payload,
                        updatedAggregates[0]!
                      ),
                      kind: 'desc',
                    },
                  ],
                  options
                );
              } else {
                setSort([], options);
              }
            }
          }
          break;
        default:
          break;
      }
    },
    [
      setTitle,
      setDescription,
      setDisplayType,
      setDataset,
      setFields,
      setYAxis,
      setQuery,
      setSort,
      setLimit,
      setLegendAlias,
      setSelectedAggregate,
      setThresholds,
      setLinkedDashboards,
      fields,
      yAxis,
      displayType,
      linkedDashboards,
      query,
      sort,
      dataset,
      limit,
      setTraceMetric,
      traceMetric,
    ]
  );

  return {
    state,
    dispatch,
  };
}

/**
 * Decodes the display type from the query params
 * Returns the default display type if the value is not a valid display type
 */
function deserializeDisplayType(value: string): DisplayType {
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

function serializeLinkedDashboards(linkedDashboards: LinkedDashboard[] = []): string[] {
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
      return undefined;
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

export function serializeTraceMetric(traceMetric: TraceMetric | undefined): string {
  return JSON.stringify(traceMetric);
}

function deserializeTraceMetric(traceMetric: string): TraceMetric | undefined {
  if (traceMetric === '') {
    return undefined;
  }
  return JSON.parse(traceMetric);
}

function checkTraceMetricSortUsed(
  sort: Sort[],
  traceMetric: TraceMetric,
  yAxis: Column[] = [],
  fields: Column[] = []
): boolean {
  const sortValue = sort[0]?.field;
  const sortInFields = fields?.some(
    field =>
      generateFieldAsString(field) === sortValue ||
      generateMetricAggregate(traceMetric, field) === sortValue
  );
  const sortInYAxis = yAxis?.some(
    field => generateMetricAggregate(traceMetric, field) === sortValue
  );
  return sortInFields || sortInYAxis;
}

export default useWidgetBuilderState;
