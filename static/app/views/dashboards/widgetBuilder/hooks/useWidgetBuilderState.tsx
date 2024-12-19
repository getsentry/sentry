import {useCallback, useMemo} from 'react';
import partition from 'lodash/partition';

import {
  type Column,
  explodeField,
  generateFieldAsString,
  isAggregateFieldOrEquation,
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
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';
import {DEFAULT_RESULTS_LIMIT} from 'sentry/views/dashboards/widgetBuilder/utils';

export type WidgetBuilderStateQueryParams = {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  field?: (string | undefined)[];
  limit?: number;
  query?: string[];
  sort?: string[];
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
  | {payload: number; type: typeof BuilderStateAction.SET_LIMIT};

export interface WidgetBuilderState {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  fields?: Column[];
  limit?: number;
  query?: string[];
  sort?: Sort[];
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

  const state = useMemo(
    () => ({title, description, displayType, dataset, fields, yAxis, query, sort, limit}),
    [title, description, displayType, dataset, fields, yAxis, query, sort, limit]
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
          if (action.payload === DisplayType.BIG_NUMBER) {
            setSort([]);
          }
          const [aggregates, columns] = partition(fields, field => {
            const fieldString = generateFieldAsString(field);
            return isAggregateFieldOrEquation(fieldString);
          });
          if (action.payload === DisplayType.TABLE) {
            setYAxis([]);
            setFields([...columns, ...aggregates, ...(yAxis ?? [])]);
          } else {
            setFields(columns);
            setYAxis([
              ...aggregates.slice(0, MAX_NUM_Y_AXES),
              ...(yAxis?.slice(0, MAX_NUM_Y_AXES) ?? []),
            ]);
          }
          break;
        case BuilderStateAction.SET_DATASET:
          setDataset(action.payload);

          let newDisplayType;
          if (action.payload === WidgetType.ISSUE) {
            // Issues only support table display type
            setDisplayType(DisplayType.TABLE);
            newDisplayType = DisplayType.TABLE;
          }

          const config = getDatasetConfig(action.payload);
          setFields(
            config.defaultWidgetQuery.fields?.map(field => explodeField({field}))
          );
          if (newDisplayType === DisplayType.TABLE) {
            setYAxis([]);
          } else {
            setYAxis(
              config.defaultWidgetQuery.aggregates?.map(aggregate =>
                explodeField({field: aggregate})
              )
            );
          }
          setQuery([config.defaultWidgetQuery.conditions]);
          setSort(decodeSorts(config.defaultWidgetQuery.orderby));
          break;
        case BuilderStateAction.SET_FIELDS:
          setFields(action.payload);
          break;
        case BuilderStateAction.SET_Y_AXIS:
          setYAxis(action.payload);
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
      fields,
      yAxis,
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
  return fields.map(field => explodeField({field}));
}

/**
 * Takes fields in the field and function format and coverts
 * them into a list of strings compatible with query params
 */
function serializeFields(fields: Column[]): string[] {
  return fields.map(generateFieldAsString);
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

export default useWidgetBuilderState;
