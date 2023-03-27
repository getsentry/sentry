import {Location, Query} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import isString from 'lodash/isString';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import uniqBy from 'lodash/uniqBy';
import moment from 'moment';

import {EventQuery} from 'sentry/actionCreators/events';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_PER_PAGE} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS, URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {
  NewQuery,
  PageFilters,
  Project,
  SavedQuery,
  SelectValue,
  User,
} from 'sentry/types';
import {
  aggregateOutputType,
  Column,
  ColumnType,
  Field,
  generateFieldAsString,
  getAggregateAlias,
  getEquation,
  isAggregateEquation,
  isAggregateField,
  isEquation,
  isLegalYAxisType,
  Sort,
} from 'sentry/utils/discover/fields';
import {
  CHART_AXIS_OPTIONS,
  DiscoverDatasets,
  DISPLAY_MODE_FALLBACK_OPTIONS,
  DISPLAY_MODE_OPTIONS,
  DisplayModes,
  TOP_N,
} from 'sentry/utils/discover/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import toArray from 'sentry/utils/toArray';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  FieldValueKind,
  TableColumn,
  TableColumnSort,
} from 'sentry/views/discover/table/types';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {EventsDisplayFilterName} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';

import {statsPeriodToDays} from '../dates';
import {WebVital} from '../fields';
import {MutableSearch} from '../tokenizeSearch';

import {getSortField} from './fieldRenderers';

// Metadata mapping for discover results.
export type MetaType = Record<string, ColumnType> & {
  isMetricsData?: boolean;
  tips?: {columns: string; query: string};
  units?: Record<string, string>;
};
export type EventsMetaType = {fields: Record<string, ColumnType>} & {
  isMetricsData?: boolean;
};

// Data in discover results.
export type EventData = Record<string, any>;

export type LocationQuery = {
  cursor?: string | string[] | null;
  end?: string | string[] | null;
  start?: string | string[] | null;
  statsPeriod?: string | string[] | null;
  utc?: string | string[] | null;
};

const DATETIME_QUERY_STRING_KEYS = ['start', 'end', 'utc', 'statsPeriod'] as const;

const EXTERNAL_QUERY_STRING_KEYS: Readonly<Array<keyof LocationQuery>> = [
  ...DATETIME_QUERY_STRING_KEYS,
  'cursor',
];

const setSortOrder = (sort: Sort, kind: 'desc' | 'asc'): Sort => ({
  kind,
  field: sort.field,
});

const reverseSort = (sort: Sort): Sort => ({
  kind: sort.kind === 'desc' ? 'asc' : 'desc',
  field: sort.field,
});

const isSortEqualToField = (
  sort: Sort,
  field: Field,
  tableMeta: MetaType | undefined
): boolean => {
  const sortKey = getSortKeyFromField(field, tableMeta);
  return sort.field === sortKey;
};

const fieldToSort = (
  field: Field,
  tableMeta: MetaType | undefined,
  kind?: 'desc' | 'asc',
  useFunctionFormat?: boolean
): Sort | undefined => {
  const sortKey = getSortKeyFromField(field, tableMeta, useFunctionFormat);

  if (!sortKey) {
    return void 0;
  }

  return {
    kind: kind || 'desc',
    field: sortKey,
  };
};

function getSortKeyFromField(
  field: Field,
  tableMeta?: MetaType,
  useFunctionFormat?: boolean
): string | null {
  const fieldString = useFunctionFormat ? field.field : getAggregateAlias(field.field);
  return getSortField(fieldString, tableMeta);
}

export function isFieldSortable(field: Field, tableMeta?: MetaType): boolean {
  return !!getSortKeyFromField(field, tableMeta);
}

const decodeFields = (location: Location): Array<Field> => {
  const {query} = location;
  if (!query || !query.field) {
    return [];
  }

  const fields = decodeList(query.field);
  const widths = decodeList(query.widths);

  const parsed: Field[] = [];
  fields.forEach((field, i) => {
    const w = Number(widths[i]);
    const width = !isNaN(w) ? w : COL_WIDTH_UNDEFINED;

    parsed.push({field, width});
  });

  return parsed;
};

const parseSort = (sort: string): Sort => {
  sort = sort.trim();

  if (sort.startsWith('-')) {
    return {
      kind: 'desc',
      field: sort.substring(1),
    };
  }

  return {
    kind: 'asc',
    field: sort,
  };
};

export const fromSorts = (sorts: string | string[] | undefined): Array<Sort> => {
  if (sorts === undefined) {
    return [];
  }

  sorts = isString(sorts) ? [sorts] : sorts;

  // NOTE: sets are iterated in insertion order
  const uniqueSorts = [...new Set(sorts)];

  return uniqueSorts.reduce((acc: Array<Sort>, sort: string) => {
    acc.push(parseSort(sort));
    return acc;
  }, []);
};

export const decodeSorts = (location: Location): Array<Sort> => {
  const {query} = location;

  if (!query || !query.sort) {
    return [];
  }
  const sorts = decodeList(query.sort);
  return fromSorts(sorts);
};

export const encodeSort = (sort: Sort): string => {
  switch (sort.kind) {
    case 'desc': {
      return `-${sort.field}`;
    }
    case 'asc': {
      return String(sort.field);
    }
    default: {
      throw new Error('Unexpected sort type');
    }
  }
};

const encodeSorts = (sorts: Readonly<Array<Sort>>): Array<string> =>
  sorts.map(encodeSort);

const collectQueryStringByKey = (query: Query, key: string): Array<string> => {
  const needle = query[key];
  const collection = decodeList(needle);
  return collection.reduce((acc: Array<string>, item: string) => {
    item = item.trim();

    if (item.length > 0) {
      acc.push(item);
    }

    return acc;
  }, []);
};

const decodeQuery = (location: Location): string => {
  if (!location.query || !location.query.query) {
    return '';
  }

  const queryParameter = location.query.query;

  return decodeScalar(queryParameter, '').trim();
};

const decodeTeam = (value: string): 'myteams' | number => {
  if (value === 'myteams') {
    return value;
  }
  return parseInt(value, 10);
};

const decodeTeams = (location: Location): ('myteams' | number)[] => {
  if (!location.query || !location.query.team) {
    return [];
  }
  const value = location.query.team;
  return toArray(value)
    .map(decodeTeam)
    .filter(team => team === 'myteams' || !isNaN(team));
};

const decodeProjects = (location: Location): number[] => {
  if (!location.query || !location.query.project) {
    return [];
  }

  const value = location.query.project;
  return toArray(value).map(i => parseInt(i, 10));
};

const queryStringFromSavedQuery = (saved: NewQuery | SavedQuery): string => {
  if (saved.query) {
    return saved.query || '';
  }
  return '';
};

function validateTableMeta(tableMeta: MetaType | undefined): MetaType | undefined {
  return tableMeta && Object.keys(tableMeta).length > 0 ? tableMeta : undefined;
}

class EventView {
  id: string | undefined;
  name: string | undefined;
  fields: Readonly<Field[]>;
  sorts: Readonly<Sort[]>;
  query: string;
  team: Readonly<('myteams' | number)[]>;
  project: Readonly<number[]>;
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
  utc?: string | boolean | undefined;
  environment: Readonly<string[]>;
  yAxis: string | undefined;
  display: string | undefined;
  topEvents: string | undefined;
  interval: string | undefined;
  expired?: boolean;
  createdBy: User | undefined;
  additionalConditions: MutableSearch; // This allows views to always add additional conditions to the query to get specific data. It should not show up in the UI unless explicitly called.
  dataset?: DiscoverDatasets;

  constructor(props: {
    additionalConditions: MutableSearch;
    createdBy: User | undefined;
    display: string | undefined;
    end: string | undefined;
    environment: Readonly<string[]>;
    fields: Readonly<Field[]>;
    id: string | undefined;
    name: string | undefined;
    project: Readonly<number[]>;
    query: string;
    sorts: Readonly<Sort[]>;
    start: string | undefined;
    statsPeriod: string | undefined;
    team: Readonly<('myteams' | number)[]>;
    topEvents: string | undefined;
    yAxis: string | undefined;
    dataset?: DiscoverDatasets;
    expired?: boolean;
    interval?: string;
    utc?: string | boolean | undefined;
  }) {
    const fields: Field[] = Array.isArray(props.fields) ? props.fields : [];
    let sorts: Sort[] = Array.isArray(props.sorts) ? props.sorts : [];
    const team = Array.isArray(props.team) ? props.team : [];
    const project = Array.isArray(props.project) ? props.project : [];
    const environment = Array.isArray(props.environment) ? props.environment : [];

    // only include sort keys that are included in the fields
    let equations = 0;
    const sortKeys: string[] = [];
    fields.forEach(field => {
      if (field.field && isEquation(field.field)) {
        const sortKey = getSortKeyFromField({field: `equation[${equations}]`}, undefined);
        equations += 1;
        if (sortKey) {
          sortKeys.push(sortKey);
        }
      }
      const sortKey = getSortKeyFromField(field, undefined);
      if (sortKey) {
        sortKeys.push(sortKey);
      }
    });

    const sort = sorts.find(currentSort => sortKeys.includes(currentSort.field));
    sorts = sort ? [sort] : [];

    const id = props.id !== null && props.id !== void 0 ? String(props.id) : void 0;

    this.id = id;
    this.name = props.name;
    this.fields = fields;
    this.sorts = sorts;
    this.query = typeof props.query === 'string' ? props.query : '';
    this.team = team;
    this.project = project;
    this.start = props.start;
    this.end = props.end;
    this.statsPeriod = props.statsPeriod;
    this.utc = props.utc;
    this.environment = environment;
    this.yAxis = props.yAxis;
    this.dataset = props.dataset;
    this.display = props.display;
    this.topEvents = props.topEvents;
    this.interval = props.interval;
    this.createdBy = props.createdBy;
    this.expired = props.expired;
    this.additionalConditions = props.additionalConditions
      ? props.additionalConditions.copy()
      : new MutableSearch([]);
  }

  static fromLocation(location: Location): EventView {
    const {start, end, statsPeriod} = normalizeDateTimeParams(location.query);

    return new EventView({
      id: decodeScalar(location.query.id),
      name: decodeScalar(location.query.name),
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      query: decodeQuery(location),
      team: decodeTeams(location),
      project: decodeProjects(location),
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      environment: collectQueryStringByKey(location.query, 'environment'),
      yAxis: decodeScalar(location.query.yAxis),
      display: decodeScalar(location.query.display),
      topEvents: decodeScalar(location.query.topEvents),
      interval: decodeScalar(location.query.interval),
      createdBy: undefined,
      additionalConditions: new MutableSearch([]),
      dataset: decodeScalar(location.query.dataset) as DiscoverDatasets,
    });
  }

  static fromNewQueryWithLocation(newQuery: NewQuery, location: Location): EventView {
    const query = location.query;

    // apply global selection header values from location whenever possible
    const environment: string[] =
      Array.isArray(newQuery.environment) && newQuery.environment.length > 0
        ? newQuery.environment
        : collectQueryStringByKey(query, 'environment');

    const project: number[] =
      Array.isArray(newQuery.projects) && newQuery.projects.length > 0
        ? newQuery.projects
        : decodeProjects(location);

    const saved: NewQuery = {
      ...newQuery,

      environment,
      projects: project,

      // datetime selection
      start: newQuery.start || decodeScalar(query.start),
      end: newQuery.end || decodeScalar(query.end),
      range: newQuery.range || decodeScalar(query.statsPeriod),
    };

    return EventView.fromSavedQuery(saved);
  }

  static getFields(saved: NewQuery | SavedQuery) {
    return saved.fields.map((field, i) => {
      const width =
        saved.widths && saved.widths[i] ? Number(saved.widths[i]) : COL_WIDTH_UNDEFINED;

      return {field, width};
    });
  }

  static fromSavedQuery(saved: NewQuery | SavedQuery): EventView {
    const fields = EventView.getFields(saved);
    // normalize datetime selection
    const {start, end, statsPeriod, utc} = normalizeDateTimeParams({
      start: saved.start,
      end: saved.end,
      statsPeriod: saved.range,
      utc: saved.utc,
    });

    return new EventView({
      id: saved.id,
      name: saved.name,
      fields,
      query: queryStringFromSavedQuery(saved),
      team: saved.teams ?? [],
      project: saved.projects,
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      utc,
      sorts: fromSorts(saved.orderby),
      environment: collectQueryStringByKey(
        {
          environment: saved.environment as string[],
        },
        'environment'
      ),
      // Workaround to only use the first yAxis since eventView yAxis doesn't accept string[]
      yAxis: Array.isArray(saved.yAxis) ? saved.yAxis[0] : saved.yAxis,
      display: saved.display,
      topEvents: saved.topEvents ? saved.topEvents.toString() : undefined,
      interval: saved.interval,
      createdBy: saved.createdBy,
      expired: saved.expired,
      additionalConditions: new MutableSearch([]),
      dataset: saved.dataset,
    });
  }

  static fromSavedQueryOrLocation(
    saved: SavedQuery | undefined,
    location: Location
  ): EventView {
    let fields = decodeFields(location);
    const id = decodeScalar(location.query.id);
    const teams = decodeTeams(location);
    const projects = decodeProjects(location);
    const sorts = decodeSorts(location);
    const environments = collectQueryStringByKey(location.query, 'environment');

    if (saved) {
      if (fields.length === 0) {
        fields = EventView.getFields(saved);
      }

      const {start, end, statsPeriod, utc} = normalizeDateTimeParams(
        location.query.start ||
          location.query.end ||
          location.query.statsPeriod ||
          location.query.utc
          ? location.query
          : {
              start: saved.start,
              end: saved.end,
              statsPeriod: saved.range,
              utc: saved.utc,
            }
      );
      return new EventView({
        id: id || saved.id,
        name: decodeScalar(location.query.name) || saved.name,
        fields,
        query:
          'query' in location.query
            ? decodeQuery(location)
            : queryStringFromSavedQuery(saved),
        sorts: sorts.length === 0 ? fromSorts(saved.orderby) : sorts,
        yAxis:
          decodeScalar(location.query.yAxis) ||
          // Workaround to only use the first yAxis since eventView yAxis doesn't accept string[]
          (Array.isArray(saved.yAxis) ? saved.yAxis[0] : saved.yAxis),
        display: decodeScalar(location.query.display) || saved.display,
        topEvents: (
          decodeScalar(location.query.topEvents) ||
          saved.topEvents ||
          TOP_N
        ).toString(),
        interval: decodeScalar(location.query.interval) || saved.interval,
        createdBy: saved.createdBy,
        expired: saved.expired,
        additionalConditions: new MutableSearch([]),
        // Always read team from location since they can be set by other parts
        // of the UI
        team: teams,
        // Always read project and environment from location since they can
        // be set by the GlobalSelectionHeaders.
        project: projects,
        environment: environments,
        start: decodeScalar(start),
        end: decodeScalar(end),
        statsPeriod: decodeScalar(statsPeriod),
        utc,
        dataset:
          (decodeScalar(location.query.dataset) as DiscoverDatasets) ?? saved.dataset,
      });
    }
    return EventView.fromLocation(location);
  }

  isEqualTo(other: EventView, omitList: string[] = []): boolean {
    const defaults = {
      id: undefined,
      name: undefined,
      query: undefined,
      statsPeriod: undefined,
      fields: undefined,
      sorts: undefined,
      project: undefined,
      environment: undefined,
      interval: undefined,
      yAxis: 'count()',
      display: DisplayModes.DEFAULT,
      topEvents: '5',
      dataset: DiscoverDatasets.DISCOVER,
    };
    const keys = Object.keys(defaults).filter(key => !omitList.includes(key));
    for (const key of keys) {
      const currentValue = this[key] ?? defaults[key];
      const otherValue = other[key] ?? defaults[key];

      if (!isEqual(currentValue, otherValue)) {
        return false;
      }
    }

    // compare datetime selections using moment

    const dateTimeKeys = ['start', 'end'];

    for (const key of dateTimeKeys) {
      const currentValue = this[key];
      const otherValue = other[key];

      if (currentValue && otherValue) {
        const currentDateTime = moment.utc(currentValue);
        const otherDateTime = moment.utc(otherValue);

        if (!currentDateTime.isSame(otherDateTime)) {
          return false;
        }
      }
    }

    return true;
  }

  toNewQuery(): NewQuery {
    const orderby = this.sorts.length > 0 ? encodeSorts(this.sorts)[0] : undefined;

    const newQuery: NewQuery = {
      version: 2,
      id: this.id,
      name: this.name || '',
      fields: this.getFields(),
      widths: this.getWidths().map(w => String(w)),
      orderby,
      query: this.query || '',
      projects: this.project,
      start: this.start,
      end: this.end,
      range: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis ? [this.yAxis] : undefined,
      dataset: this.dataset,
      display: this.display,
      topEvents: this.topEvents,
      interval: this.interval,
    };

    if (!newQuery.query) {
      // if query is an empty string, then it cannot be saved, so we omit it
      // from the payload
      delete newQuery.query;
    }

    return newQuery;
  }

  getPageFilters(): PageFilters {
    return {
      projects: this.project as number[],
      environments: this.environment as string[],
      datetime: {
        start: this.start ?? null,
        end: this.end ?? null,
        period: this.statsPeriod ?? null,
        // TODO(tony) Add support for the Use UTC option from the global
        // headers, currently, that option is not supported and all times are
        // assumed to be UTC
        utc: true,
      },
    };
  }

  getPageFiltersQuery(): Query {
    const {
      environments: environment,
      projects,
      datetime: {start, end, period, utc},
    } = this.getPageFilters();
    return {
      project: projects.map(proj => proj.toString()),
      environment,
      utc: utc ? 'true' : 'false',

      // since these values are from `getGlobalSelection`
      // we know they have type `string | null`
      start: (start ?? undefined) as string | undefined,
      end: (end ?? undefined) as string | undefined,

      // we can't use the ?? operator here as we want to
      // convert the empty string to undefined
      statsPeriod: period ? period : undefined,
    };
  }

  generateBlankQueryStringObject(): Query {
    const output = {
      id: undefined,
      name: undefined,
      field: undefined,
      widths: undefined,
      sort: undefined,
      tag: undefined,
      query: undefined,
      yAxis: undefined,
      display: undefined,
      topEvents: undefined,
      interval: undefined,
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      output[field] = undefined;
    }

    return output;
  }

  generateQueryStringObject(): Query {
    const output = {
      id: this.id,
      name: this.name,
      field: this.getFields(),
      widths: this.getWidths(),
      sort: encodeSorts(this.sorts),
      environment: this.environment,
      project: this.project,
      query: this.query,
      yAxis: this.yAxis || this.getYAxis(),
      dataset: this.dataset,
      display: this.display,
      topEvents: this.topEvents,
      interval: this.interval,
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }

    return cloneDeep(output as any);
  }

  isValid(): boolean {
    return this.fields.length > 0;
  }

  getWidths(): number[] {
    const result = this.fields.map(field =>
      field.width ? field.width : COL_WIDTH_UNDEFINED
    );

    while (result.length > 0) {
      const width = result[result.length - 1];
      if (width === COL_WIDTH_UNDEFINED) {
        result.pop();
        continue;
      }
      break;
    }

    return result;
  }

  getFields(): string[] {
    return this.fields.map(field => field.field);
  }

  getEquations(): string[] {
    return this.fields
      .filter(field => isEquation(field.field))
      .map(field => getEquation(field.field));
  }

  getAggregateFields(): Field[] {
    return this.fields.filter(
      field => isAggregateField(field.field) || isAggregateEquation(field.field)
    );
  }

  hasAggregateField() {
    return this.fields.some(field => isAggregateField(field.field));
  }

  hasIdField() {
    return this.fields.some(field => field.field === 'id');
  }

  numOfColumns(): number {
    return this.fields.length;
  }

  getColumns(): TableColumn<React.ReactText>[] {
    return decodeColumnOrder(this.fields);
  }

  getDays(): number {
    const statsPeriod = decodeScalar(this.statsPeriod);
    return statsPeriodToDays(statsPeriod, this.start, this.end);
  }

  clone(): EventView {
    // NOTE: We rely on usage of Readonly from TypeScript to ensure we do not mutate
    //       the attributes of EventView directly. This enables us to quickly
    //       clone new instances of EventView.

    return new EventView({
      id: this.id,
      name: this.name,
      fields: this.fields,
      sorts: this.sorts,
      query: this.query,
      team: this.team,
      project: this.project,
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis,
      dataset: this.dataset,
      display: this.display,
      topEvents: this.topEvents,
      interval: this.interval,
      expired: this.expired,
      createdBy: this.createdBy,
      additionalConditions: this.additionalConditions.copy(),
    });
  }

  withSorts(sorts: Sort[]): EventView {
    const newEventView = this.clone();
    const fields = newEventView.fields.map(field => getAggregateAlias(field.field));
    newEventView.sorts = sorts.filter(sort => fields.includes(sort.field));

    return newEventView;
  }

  withColumns(columns: Column[]): EventView {
    const newEventView = this.clone();
    const fields: Field[] = columns
      .filter(
        col =>
          ((col.kind === 'field' || col.kind === FieldValueKind.EQUATION) && col.field) ||
          (col.kind === 'function' && col.function[0])
      )
      .map(col => generateFieldAsString(col))
      .map((field, i) => {
        // newly added field
        if (!newEventView.fields[i]) {
          return {field, width: COL_WIDTH_UNDEFINED};
        }
        // Existing columns that were not re ordered should retain
        // their old widths.
        const existing = newEventView.fields[i];
        const width =
          existing.field === field && existing.width !== undefined
            ? existing.width
            : COL_WIDTH_UNDEFINED;
        return {field, width};
      });
    newEventView.fields = fields;

    // Update sorts as sorted fields may have been removed.
    if (newEventView.sorts) {
      // Filter the sort fields down to those that are still selected.
      const sortKeys = fields.map(field => fieldToSort(field, undefined)?.field);
      const newSort = newEventView.sorts.filter(
        sort => sort && sortKeys.includes(sort.field)
      );
      // If the sort field was removed, try and find a new sortable column.
      if (newSort.length === 0) {
        const sortField = fields.find(field => isFieldSortable(field, undefined));
        if (sortField) {
          newSort.push({field: sortField.field, kind: 'desc'});
        }
      }
      newEventView.sorts = newSort;
    }

    newEventView.yAxis = newEventView.getYAxis();

    return newEventView;
  }

  withNewColumn(newColumn: Column): EventView {
    const fieldAsString = generateFieldAsString(newColumn);
    const newField: Field = {
      field: fieldAsString,
      width: COL_WIDTH_UNDEFINED,
    };
    const newEventView = this.clone();
    newEventView.fields = [...newEventView.fields, newField];

    return newEventView;
  }

  withResizedColumn(columnIndex: number, newWidth: number) {
    const field = this.fields[columnIndex];
    const newEventView = this.clone();
    if (!field) {
      return newEventView;
    }

    const updateWidth = field.width !== newWidth;
    if (updateWidth) {
      const fields = [...newEventView.fields];
      fields[columnIndex] = {
        ...field,
        width: newWidth,
      };
      newEventView.fields = fields;
    }

    return newEventView;
  }

  withUpdatedColumn(
    columnIndex: number,
    updatedColumn: Column,
    tableMeta: MetaType | undefined
  ): EventView {
    const columnToBeUpdated = this.fields[columnIndex];
    const fieldAsString = generateFieldAsString(updatedColumn);

    const updateField = columnToBeUpdated.field !== fieldAsString;
    if (!updateField) {
      return this;
    }

    // ensure tableMeta is non-empty
    tableMeta = validateTableMeta(tableMeta);

    const newEventView = this.clone();

    const updatedField: Field = {
      field: fieldAsString,
      width: COL_WIDTH_UNDEFINED,
    };

    const fields = [...newEventView.fields];
    fields[columnIndex] = updatedField;

    newEventView.fields = fields;

    // if the updated column is one of the sorted columns, we may need to remove
    // it from the list of sorts
    const needleSortIndex = this.sorts.findIndex(sort =>
      isSortEqualToField(sort, columnToBeUpdated, tableMeta)
    );

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];

      const numOfColumns = this.fields.reduce((sum, currentField) => {
        if (isSortEqualToField(needleSort, currentField, tableMeta)) {
          return sum + 1;
        }

        return sum;
      }, 0);

      // do not bother deleting the sort key if there are more than one columns
      // of it in the table.
      if (numOfColumns <= 1) {
        if (isFieldSortable(updatedField, tableMeta)) {
          // use the current updated field as the sort key
          const sort = fieldToSort(updatedField, tableMeta)!;

          // preserve the sort kind
          sort.kind = needleSort.kind;

          const sorts = [...newEventView.sorts];
          sorts[needleSortIndex] = sort;
          newEventView.sorts = sorts;
        } else {
          const sorts = [...newEventView.sorts];
          sorts.splice(needleSortIndex, 1);
          newEventView.sorts = [...new Set(sorts)];
        }
      }

      if (newEventView.sorts.length <= 0 && newEventView.fields.length > 0) {
        // establish a default sort by finding the first sortable field

        if (isFieldSortable(updatedField, tableMeta)) {
          // use the current updated field as the sort key
          const sort = fieldToSort(updatedField, tableMeta)!;

          // preserve the sort kind
          sort.kind = needleSort.kind;

          newEventView.sorts = [sort];
        } else {
          const sortableFieldIndex = newEventView.fields.findIndex(currentField =>
            isFieldSortable(currentField, tableMeta)
          );
          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableMeta)!;
            newEventView.sorts = [sort];
          }
        }
      }
    }

    newEventView.yAxis = newEventView.getYAxis();

    return newEventView;
  }

  withDeletedColumn(columnIndex: number, tableMeta: MetaType | undefined): EventView {
    // Disallow removal of the orphan column, and check for out-of-bounds
    if (this.fields.length <= 1 || this.fields.length <= columnIndex || columnIndex < 0) {
      return this;
    }

    // ensure tableMeta is non-empty
    tableMeta = validateTableMeta(tableMeta);

    // delete the column
    const newEventView = this.clone();
    const fields = [...newEventView.fields];
    fields.splice(columnIndex, 1);
    newEventView.fields = fields;

    // Ensure there is at least one auto width column
    // To ensure a well formed table results.
    const hasAutoIndex = fields.find(field => field.width === COL_WIDTH_UNDEFINED);
    if (!hasAutoIndex) {
      newEventView.fields[0].width = COL_WIDTH_UNDEFINED;
    }

    // if the deleted column is one of the sorted columns, we need to remove
    // it from the list of sorts
    const columnToBeDeleted = this.fields[columnIndex];
    const needleSortIndex = this.sorts.findIndex(sort =>
      isSortEqualToField(sort, columnToBeDeleted, tableMeta)
    );

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];

      const numOfColumns = this.fields.reduce((sum, field) => {
        if (isSortEqualToField(needleSort, field, tableMeta)) {
          return sum + 1;
        }

        return sum;
      }, 0);

      // do not bother deleting the sort key if there are more than one columns
      // of it in the table.
      if (numOfColumns <= 1) {
        const sorts = [...newEventView.sorts];
        sorts.splice(needleSortIndex, 1);
        newEventView.sorts = [...new Set(sorts)];

        if (newEventView.sorts.length <= 0 && newEventView.fields.length > 0) {
          // establish a default sort by finding the first sortable field
          const sortableFieldIndex = newEventView.fields.findIndex(field =>
            isFieldSortable(field, tableMeta)
          );

          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableMeta)!;
            newEventView.sorts = [sort];
          }
        }
      }
    }

    newEventView.yAxis = newEventView.getYAxis();

    return newEventView;
  }

  withTeams(teams: ('myteams' | number)[]): EventView {
    const newEventView = this.clone();
    newEventView.team = teams;
    return newEventView;
  }

  getSorts(): TableColumnSort<React.ReactText>[] {
    return this.sorts.map(
      sort =>
        ({
          key: sort.field,
          order: sort.kind,
        } as TableColumnSort<string>)
    );
  }

  // returns query input for the search
  getQuery(inputQuery: string | string[] | null | undefined): string {
    const queryParts: string[] = [];

    if (this.query) {
      if (this.additionalConditions) {
        queryParts.push(this.getQueryWithAdditionalConditions());
      } else {
        queryParts.push(this.query);
      }
    }

    if (inputQuery) {
      // there may be duplicate query in the query string
      // e.g. query=hello&query=world
      if (Array.isArray(inputQuery)) {
        inputQuery.forEach(query => {
          if (typeof query === 'string' && !queryParts.includes(query)) {
            queryParts.push(query);
          }
        });
      }

      if (typeof inputQuery === 'string' && !queryParts.includes(inputQuery)) {
        queryParts.push(inputQuery);
      }
    }

    return queryParts.join(' ');
  }

  getFacetsAPIPayload(
    location: Location
  ): Exclude<EventQuery & LocationQuery, 'sort' | 'cursor'> {
    const payload = this.getEventsAPIPayload(location);

    const remove = [
      'id',
      'name',
      'per_page',
      'sort',
      'cursor',
      'field',
      'equation',
      'interval',
    ];
    for (const key of remove) {
      delete payload[key];
    }

    return payload;
  }

  normalizeDateSelection(location: Location) {
    const query = (location && location.query) || {};

    // pick only the query strings that we care about
    const picked = pickRelevantLocationQueryStrings(location);

    const hasDateSelection = this.statsPeriod || (this.start && this.end);

    // an eventview's date selection has higher precedence than the date selection in the query string
    const dateSelection = hasDateSelection
      ? {
          start: this.start,
          end: this.end,
          statsPeriod: this.statsPeriod,
        }
      : {
          start: picked.start,
          end: picked.end,
          period: decodeScalar(query.period),
          statsPeriod: picked.statsPeriod,
        };

    // normalize datetime selection
    return normalizeDateTimeParams({
      ...dateSelection,
      utc: decodeScalar(query.utc),
    });
  }

  // Takes an EventView instance and converts it into the format required for the events API
  getEventsAPIPayload(
    location: Location,
    forceAppendRawQueryString?: string
  ): EventQuery & LocationQuery {
    // pick only the query strings that we care about
    const picked = pickRelevantLocationQueryStrings(location);

    // normalize datetime selection
    const normalizedTimeWindowParams = this.normalizeDateSelection(location);

    const sort =
      this.sorts.length <= 0
        ? undefined
        : this.sorts.length > 1
        ? encodeSorts(this.sorts)
        : encodeSort(this.sorts[0]);
    const fields = this.getFields();
    const team = this.team.map(proj => String(proj));
    const project = this.project.map(proj => String(proj));
    const environment = this.environment as string[];

    let queryString = this.getQueryWithAdditionalConditions();
    if (forceAppendRawQueryString) {
      queryString += ' ' + forceAppendRawQueryString;
    }

    // generate event query
    const eventQuery = Object.assign(
      omit(picked, DATETIME_QUERY_STRING_KEYS),
      normalizedTimeWindowParams,
      {
        team,
        project,
        environment,
        field: [...new Set(fields)],
        sort,
        per_page: DEFAULT_PER_PAGE,
        query: queryString,
        dataset: this.dataset,
      }
    ) as EventQuery & LocationQuery;

    if (eventQuery.team && !eventQuery.team.length) {
      delete eventQuery.team;
    }

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  }

  getResultsViewUrlTarget(
    slug: string,
    isHomepage: boolean = false
  ): {pathname: string; query: Query} {
    const target = isHomepage ? 'homepage' : 'results';
    return {
      pathname: normalizeUrl(`/organizations/${slug}/discover/${target}/`),
      query: this.generateQueryStringObject(),
    };
  }

  getResultsViewShortUrlTarget(slug: string): {pathname: string; query: Query} {
    const output = {id: this.id};
    for (const field of [...Object.values(URL_PARAM), 'cursor']) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }
    return {
      pathname: normalizeUrl(`/organizations/${slug}/discover/results/`),
      query: cloneDeep(output as any),
    };
  }

  getPerformanceTransactionEventsViewUrlTarget(
    slug: string,
    options: {
      breakdown?: SpanOperationBreakdownFilter;
      showTransactions?: EventsDisplayFilterName;
      webVital?: WebVital;
    }
  ): {pathname: string; query: Query} {
    const {showTransactions, breakdown, webVital} = options;
    const output = {
      sort: encodeSorts(this.sorts),
      project: this.project,
      query: this.query,
      transaction: this.name,
      showTransactions,
      breakdown,
      webVital,
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }

    const query = cloneDeep(output as any);
    return {
      pathname: normalizeUrl(`/organizations/${slug}/performance/summary/events/`),
      query,
    };
  }

  sortForField(field: Field, tableMeta: MetaType | undefined): Sort | undefined {
    if (!tableMeta) {
      return undefined;
    }
    return this.sorts.find(sort => isSortEqualToField(sort, field, tableMeta));
  }

  sortOnField(
    field: Field,
    tableMeta: MetaType,
    kind?: 'desc' | 'asc',
    useFunctionFormat?: boolean
  ): EventView {
    // check if field can be sorted
    if (!isFieldSortable(field, tableMeta)) {
      return this;
    }

    const needleIndex = this.sorts.findIndex(sort =>
      isSortEqualToField(sort, field, tableMeta)
    );

    if (needleIndex >= 0) {
      const newEventView = this.clone();

      const currentSort = this.sorts[needleIndex];

      const sorts = [...newEventView.sorts];
      sorts[needleIndex] = kind
        ? setSortOrder(
            {...currentSort, ...(useFunctionFormat ? {field: field.field} : {})},
            kind
          )
        : reverseSort({
            ...currentSort,
            ...(useFunctionFormat ? {field: field.field} : {}),
          });

      newEventView.sorts = sorts;

      return newEventView;
    }

    // field is currently not sorted; so, we sort on it
    const newEventView = this.clone();

    // invariant: this is not falsey, since sortKey exists
    const sort = fieldToSort(field, tableMeta, kind, useFunctionFormat)!;

    newEventView.sorts = [sort];

    return newEventView;
  }

  getYAxisOptions(): SelectValue<string>[] {
    // Make option set and add the default options in.
    return uniqBy(
      this.getAggregateFields()
        // Only include aggregates that make sense to be graphable (eg. not string or date)
        .filter(
          (field: Field) =>
            isLegalYAxisType(aggregateOutputType(field.field)) ||
            isAggregateEquation(field.field)
        )
        .map((field: Field) => ({
          label: isEquation(field.field) ? getEquation(field.field) : field.field,
          value: field.field,
        }))
        .concat(CHART_AXIS_OPTIONS),
      'value'
    );
  }

  getYAxis(): string {
    const yAxisOptions = this.getYAxisOptions();

    const yAxis = this.yAxis;
    const defaultOption = yAxisOptions[0].value;

    if (!yAxis) {
      return defaultOption;
    }

    // ensure current selected yAxis is one of the items in yAxisOptions
    const result = yAxisOptions.findIndex(
      (option: SelectValue<string>) => option.value === yAxis
    );

    if (result >= 0) {
      return yAxis;
    }

    return defaultOption;
  }

  getDisplayOptions(): SelectValue<string>[] {
    return DISPLAY_MODE_OPTIONS.map(item => {
      if (item.value === DisplayModes.PREVIOUS) {
        if (this.start || this.end) {
          return {...item, disabled: true};
        }
      }

      if (item.value === DisplayModes.TOP5 || item.value === DisplayModes.DAILYTOP5) {
        if (this.getAggregateFields().length === 0) {
          return {
            ...item,
            disabled: true,
            tooltip: t('Add a function that groups events to use this view.'),
          };
        }
      }

      if (item.value === DisplayModes.DAILY || item.value === DisplayModes.DAILYTOP5) {
        if (this.getDays() < 1) {
          return {
            ...item,
            disabled: true,
            tooltip: t('Change the date rage to at least 1 day to use this view.'),
          };
        }
      }

      return item;
    });
  }

  getDisplayMode() {
    const mode = this.display ?? DisplayModes.DEFAULT;
    const displayOptions = this.getDisplayOptions();

    let display = (Object.values(DisplayModes) as string[]).includes(mode)
      ? mode
      : DisplayModes.DEFAULT;
    const cond = option => option.value === display;

    // Just in case we define a fallback chain that results in an infinite loop.
    // The number 5 isn't anything special, its just larger than the longest fallback
    // chain that exists and isn't too big.
    for (let i = 0; i < 5; i++) {
      const selectedOption = displayOptions.find(cond);
      if (selectedOption && !selectedOption.disabled) {
        return display;
      }
      display = DISPLAY_MODE_FALLBACK_OPTIONS[display];
    }

    // after trying to find an enabled display mode and failing to find one,
    // we just use the default display mode
    return DisplayModes.DEFAULT;
  }

  getQueryWithAdditionalConditions() {
    const {query} = this;
    if (this.additionalConditions.isEmpty()) {
      return query;
    }
    const conditions = new MutableSearch(query);
    Object.entries(this.additionalConditions.filters).forEach(([tag, tagValues]) => {
      const existingTagValues = conditions.getFilterValues(tag);
      const newTagValues = tagValues.filter(
        tagValue => !existingTagValues.includes(tagValue)
      );
      if (newTagValues.length) {
        conditions.addFilterValues(tag, newTagValues);
      }
    });
    return conditions.formatString();
  }

  /**
   * Eventview usually just holds onto a project id for selected projects.
   * Sometimes we need to iterate over the related project objects, this will give you the full projects if the Projects list is passed in.
   * Also covers the 'My Projects' case which is sometimes missed, tries using the 'isMember' property of projects to pick the right list.
   */
  getFullSelectedProjects(fullProjectList: Project[]) {
    const selectedProjectIds = this.project;
    const isMyProjects = selectedProjectIds.length === 0;
    if (isMyProjects) {
      return fullProjectList.filter(p => p.isMember);
    }
    const isAllProjects =
      selectedProjectIds.length === 1 && selectedProjectIds[0] === ALL_ACCESS_PROJECTS;
    if (isAllProjects) {
      return fullProjectList;
    }

    const projectMap = Object.fromEntries(fullProjectList.map(p => [String(p.id), p]));

    return selectedProjectIds.map(id => projectMap[String(id)]);
  }
}

export type ImmutableEventView = Readonly<Omit<EventView, 'additionalConditions'>>;

const isFieldsSimilar = (
  currentValue: Array<string>,
  otherValue: Array<string>
): boolean => {
  // For equation's their order matters because we alias them based on index
  const currentEquations = currentValue.filter(isEquation);
  const otherEquations = otherValue.filter(isEquation);

  // Field orders don't matter, so using a set for comparison
  const currentFields = new Set(currentValue.filter(value => !isEquation(value)));
  const otherFields = new Set(otherValue.filter(value => !isEquation(value)));

  if (!isEqual(currentEquations, otherEquations)) {
    return false;
  }
  if (!isEqual(currentFields, otherFields)) {
    return false;
  }
  return true;
};

export const isAPIPayloadSimilar = (
  current: EventQuery & LocationQuery,
  other: EventQuery & LocationQuery
): boolean => {
  const currentKeys = new Set(Object.keys(current));
  const otherKeys = new Set(Object.keys(other));

  if (!isEqual(currentKeys, otherKeys)) {
    return false;
  }

  for (const key of currentKeys) {
    const currentValue = current[key];
    const otherValue = other[key];
    if (key === 'field') {
      if (!isFieldsSimilar(currentValue, otherValue)) {
        return false;
      }
    } else {
      const currentTarget = Array.isArray(currentValue)
        ? new Set(currentValue)
        : currentValue;

      const otherTarget = Array.isArray(otherValue) ? new Set(otherValue) : otherValue;

      if (!isEqual(currentTarget, otherTarget)) {
        return false;
      }
    }
  }

  return true;
};

export function pickRelevantLocationQueryStrings(location: Location) {
  const query = location.query || {};
  const picked = pick(query || {}, EXTERNAL_QUERY_STRING_KEYS);

  return picked;
}

export default EventView;
