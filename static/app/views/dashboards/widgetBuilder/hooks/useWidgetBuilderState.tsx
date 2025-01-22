import {useCallback, useMemo} from 'react';
import partition from 'lodash/partition';

import {defined} from 'sentry/utils';
import {
  type Column,
  explodeField,
  generateFieldAsString,
  isAggregateFieldOrEquation,
  type QueryFieldValue,
  type Sort,
} from 'sentry/utils/discover/fields';
import {
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
} from 'sentry/utils/queryString';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';
import {DEFAULT_RESULTS_LIMIT} from 'sentry/views/dashboards/widgetBuilder/utils';
import type {Thresholds} from 'sentry/views/dashboards/widgets/common/types';

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
  SET_LIMIT: 'SET_LIMIT',
  SET_LEGEND_ALIAS: 'SET_LEGEND_ALIAS',
  SET_SELECTED_AGGREGATE: 'SET_SELECTED_AGGREGATE',
  SET_STATE: 'SET_STATE',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
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
  | {payload: number; type: typeof BuilderStateAction.SET_LIMIT}
  | {payload: string[]; type: typeof BuilderStateAction.SET_LEGEND_ALIAS}
  | {payload: number | undefined; type: typeof BuilderStateAction.SET_SELECTED_AGGREGATE}
  | {payload: WidgetBuilderStateQueryParams; type: typeof BuilderStateAction.SET_STATE}
  | {
      payload: ThresholdsConfig | undefined;
      type: typeof BuilderStateAction.SET_THRESHOLDS;
    };

export interface WidgetBuilderState {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  fields?: Column[];
  legendAlias?: string[];
  limit?: number;
  query?: string[];
  selectedAggregate?: number;
  sort?: Sort[];
  thresholds?: Thresholds;
  title?: string;
  yAxis?: Column[];
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction) => void;
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
    serializer: serializeSorts,
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
  const [thresholds, setThresholds] = useQueryParamState<ThresholdsConfig>({
    fieldName: 'thresholds',
    decoder: decodeScalar,
    deserializer: deserializeThresholds,
    serializer: serializeThresholds,
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

      // The selected aggregate is the last aggregate for big number widgets
      // if it hasn't been explicitly set
      selectedAggregate:
        displayType === DisplayType.BIG_NUMBER && defined(fields) && fields.length > 1
          ? selectedAggregate ?? fields.length - 1
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
    ]
  );

  const dispatch = useCallback(
    (action: WidgetAction) => {
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload);
          break;
        case BuilderStateAction.SET_DESCRIPTION:
          setDescription(action.payload);
          break;
        case BuilderStateAction.SET_DISPLAY_TYPE:
          setDisplayType(action.payload);
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
            setYAxis([]);
            setLegendAlias([]);
            const newFields = [
              ...columnsWithoutAlias,
              ...aggregatesWithoutAlias,
              ...(yAxisWithoutAlias ?? []),
            ];
            setFields(newFields);

            // Keep the sort if it's already contained in the new fields
            // Otherwise, reset sorting to the first field
            if (
              newFields.length > 0 &&
              !newFields.find(field => generateFieldAsString(field) === sort?.[0]?.field)
            ) {
              setSort([
                {
                  kind: 'desc',
                  field: generateFieldAsString(newFields[0] as QueryFieldValue),
                },
              ]);
            }
          } else if (action.payload === DisplayType.BIG_NUMBER) {
            // TODO: Reset the selected aggregate here for widgets with equations
            setSort([]);
            setYAxis([]);
            setLegendAlias([]);
            // Columns are ignored for big number widgets because there is no grouping
            setFields([...aggregatesWithoutAlias, ...(yAxisWithoutAlias ?? [])]);
            setQuery(query?.slice(0, 1));
          } else {
            setFields(columnsWithoutAlias);
            setYAxis([
              ...aggregatesWithoutAlias.slice(0, MAX_NUM_Y_AXES),
              ...(yAxisWithoutAlias?.slice(0, MAX_NUM_Y_AXES) ?? []),
            ]);
          }
          setThresholds(undefined);
          setSelectedAggregate(undefined);
          break;
        case BuilderStateAction.SET_DATASET:
          setDataset(action.payload);

          let nextDisplayType = displayType;
          if (action.payload === WidgetType.ISSUE) {
            // Issues only support table display type
            setDisplayType(DisplayType.TABLE);
            nextDisplayType = DisplayType.TABLE;
          }

          const config = getDatasetConfig(action.payload);
          setFields(
            config.defaultWidgetQuery.fields?.map(field => explodeField({field}))
          );
          if (
            nextDisplayType === DisplayType.TABLE ||
            nextDisplayType === DisplayType.BIG_NUMBER
          ) {
            setYAxis([]);
            setFields(
              config.defaultWidgetQuery.fields?.map(field => explodeField({field}))
            );
            setSort(
              nextDisplayType === DisplayType.BIG_NUMBER
                ? []
                : decodeSorts(config.defaultWidgetQuery.orderby)
            );
          } else {
            setFields([]);
            setYAxis(
              config.defaultWidgetQuery.aggregates?.map(aggregate =>
                explodeField({field: aggregate})
              )
            );
            setSort(decodeSorts(config.defaultWidgetQuery.orderby));
          }

          setThresholds(undefined);
          setQuery([config.defaultWidgetQuery.conditions]);
          setSelectedAggregate(undefined);
          break;
        case BuilderStateAction.SET_FIELDS:
          setFields(action.payload);
          const isRemoved = action.payload.length < (fields?.length ?? 0);
          if (
            displayType === DisplayType.TABLE &&
            action.payload.length > 0 &&
            !action.payload.find(
              field => generateFieldAsString(field) === sort?.[0]?.field
            )
          ) {
            if (dataset === WidgetType.ISSUE) {
              // Issue widgets can sort their tables by limited fields that aren't
              // in the fields array.
              return;
            }

            if (isRemoved) {
              setSort([
                {
                  kind: 'desc',
                  field: generateFieldAsString(action.payload[0] as QueryFieldValue),
                },
              ]);
            } else {
              // Find the index of the first field that doesn't match the old fields.
              const changedFieldIndex = action.payload.findIndex(
                field =>
                  !fields?.find(
                    originalField =>
                      generateFieldAsString(originalField) ===
                      generateFieldAsString(field)
                  )
              );
              if (changedFieldIndex !== -1) {
                // At this point, we can assume the fields are the same length so
                // using the changedFieldIndex in action.payload is safe.
                setSort([
                  {
                    kind: sort?.[0]?.kind ?? 'desc',
                    field: generateFieldAsString(
                      action.payload[changedFieldIndex] as QueryFieldValue
                    ),
                  },
                ]);
              }
            }
          }

          if (
            displayType !== DisplayType.TABLE &&
            displayType !== DisplayType.BIG_NUMBER &&
            action.payload.length > 0
          ) {
            // Adding a grouping, so default the sort to the first aggregate if possible
            setSort([
              {
                kind: 'desc',
                field: generateFieldAsString(
                  (yAxis?.[0] as QueryFieldValue) ??
                    (action.payload[0] as QueryFieldValue)
                ),
              },
            ]);
          }
          break;
        case BuilderStateAction.SET_Y_AXIS:
          setYAxis(action.payload);
          if (action.payload.length > 0 && fields?.length === 0) {
            // Clear the sort if there is no grouping
            setSort([]);
          }
          break;
        case BuilderStateAction.SET_QUERY:
          setQuery(action.payload);
          break;
        case BuilderStateAction.SET_SORT:
          setSort(action.payload);
          break;
        case BuilderStateAction.SET_LIMIT:
          setLimit(action.payload);
          break;
        case BuilderStateAction.SET_LEGEND_ALIAS:
          setLegendAlias(action.payload);
          break;
        case BuilderStateAction.SET_SELECTED_AGGREGATE:
          setSelectedAggregate(action.payload);
          break;
        case BuilderStateAction.SET_STATE:
          setDataset(action.payload.dataset);
          setDescription(action.payload.description);
          setDisplayType(action.payload.displayType);
          if (action.payload.field) {
            setFields(deserializeFields(action.payload.field));
          }
          setLegendAlias(action.payload.legendAlias);
          setLimit(action.payload.limit);
          setQuery(action.payload.query);
          setSelectedAggregate(action.payload.selectedAggregate);
          setSort(decodeSorts(action.payload.sort));
          setTitle(action.payload.title);
          if (action.payload.yAxis) {
            setYAxis(deserializeFields(action.payload.yAxis));
          }
          break;
        case BuilderStateAction.SET_THRESHOLDS:
          setThresholds(action.payload);
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
      fields,
      yAxis,
      displayType,
      query,
      sort,
      dataset,
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

function serializeSorts(sorts: Sort[]): string[] {
  return sorts.map(sort => {
    const direction = sort.kind === 'desc' ? '-' : '';
    return `${direction}${sort.field}`;
  });
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

export function serializeThresholds(thresholds: ThresholdsConfig): string {
  return JSON.stringify(thresholds);
}

export default useWidgetBuilderState;
