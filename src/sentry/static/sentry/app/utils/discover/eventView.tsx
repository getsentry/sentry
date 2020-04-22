import {Location, Query} from 'history';
import isString from 'lodash/isString';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import uniqBy from 'lodash/uniqBy';
import moment from 'moment';

import {DEFAULT_PER_PAGE} from 'app/constants';
import {EventQuery} from 'app/actionCreators/events';
import {SavedQuery, NewQuery, SelectValue, User} from 'app/types';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import {TableColumn, TableColumnSort} from 'app/views/eventsV2/table/types';
import {decodeColumnOrder, decodeScalar} from 'app/views/eventsV2/utils';

import {
  Sort,
  Field,
  Column,
  ColumnType,
  isAggregateField,
  getAggregateAlias,
} from './fields';
import {getSortField} from './fieldRenderers';
import {CHART_AXIS_OPTIONS, DisplayModes, DISPLAY_MODE_OPTIONS} from './types';

// Metadata mapping for discover results.
export type MetaType = Record<string, ColumnType>;

// Data in discover results.
export type EventData = Record<string, any>;

type LocationQuery = {
  start?: string | string[];
  end?: string | string[];
  utc?: string | string[];
  statsPeriod?: string | string[];
  cursor?: string | string[];
};

const DATETIME_QUERY_STRING_KEYS = ['start', 'end', 'utc', 'statsPeriod'] as const;

const EXTERNAL_QUERY_STRING_KEYS: Readonly<Array<keyof LocationQuery>> = [
  ...DATETIME_QUERY_STRING_KEYS,
  'cursor',
];

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

const fieldToSort = (field: Field, tableMeta: MetaType | undefined): Sort | undefined => {
  const sortKey = getSortKeyFromField(field, tableMeta);

  if (!sortKey) {
    return void 0;
  }

  return {
    kind: 'desc',
    field: sortKey,
  };
};

function getSortKeyFromField(field: Field, tableMeta?: MetaType): string | null {
  const alias = getAggregateAlias(field.field);
  return getSortField(alias, tableMeta);
}

export function isFieldSortable(field: Field, tableMeta?: MetaType): boolean {
  return !!getSortKeyFromField(field, tableMeta);
}

const generateFieldAsString = (col: Column): string => {
  if (col.kind === 'field') {
    return col.field;
  }

  const aggregation = col.function[0];
  const parameters = col.function.slice(1).filter(i => i);
  return `${aggregation}(${parameters.join(',')})`;
};

const decodeFields = (location: Location): Array<Field> => {
  const {query} = location;
  if (!query || !query.field) {
    return [];
  }

  // TODO(leedongwei): Probably need to refactor this into utils.tsx
  const fields: string[] = Array.isArray(query.field)
    ? query.field
    : isString(query.field)
    ? [query.field]
    : [];
  const widths = Array.isArray(query.widths)
    ? query.widths
    : isString(query.widths)
    ? [query.widths]
    : [];

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

const fromSorts = (sorts: string | string[] | undefined): Array<Sort> => {
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

const decodeSorts = (location: Location): Array<Sort> => {
  const {query} = location;

  if (!query || !query.sort) {
    return [];
  }

  const sorts: Array<string> = isString(query.sort) ? [query.sort] : query.sort;

  return fromSorts(sorts);
};

const encodeSort = (sort: Sort): string => {
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
  const collection: Array<string> = Array.isArray(needle)
    ? needle
    : typeof needle === 'string'
    ? [needle]
    : [];

  return collection.reduce((acc: Array<string>, item: string) => {
    item = item.trim();

    if (item.length > 0) {
      acc.push(item);
    }

    return acc;
  }, []);
};

const decodeQuery = (location: Location): string | undefined => {
  if (!location.query || !location.query.query) {
    return undefined;
  }

  const queryParameter = location.query.query;

  const query =
    Array.isArray(queryParameter) && queryParameter.length > 0
      ? queryParameter[0]
      : isString(queryParameter)
      ? queryParameter
      : undefined;

  return isString(query) ? query.trim() : undefined;
};

const decodeProjects = (location: Location): number[] => {
  if (!location.query || !location.query.project) {
    return [];
  }

  const value = location.query.project;
  return Array.isArray(value) ? value.map(i => parseInt(i, 10)) : [parseInt(value, 10)];
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
  project: Readonly<number[]>;
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
  environment: Readonly<string[]>;
  yAxis: string | undefined;
  display: string | undefined;
  createdBy: User | undefined;

  constructor(props: {
    id: string | undefined;
    name: string | undefined;
    fields: Readonly<Field[]>;
    sorts: Readonly<Sort[]>;
    query: string;
    project: Readonly<number[]>;
    start: string | undefined;
    end: string | undefined;
    statsPeriod: string | undefined;
    environment: Readonly<string[]>;
    yAxis: string | undefined;
    display: string | undefined;
    createdBy: User | undefined;
  }) {
    const fields: Field[] = Array.isArray(props.fields) ? props.fields : [];
    let sorts: Sort[] = Array.isArray(props.sorts) ? props.sorts : [];
    const project = Array.isArray(props.project) ? props.project : [];
    const environment = Array.isArray(props.environment) ? props.environment : [];

    // only include sort keys that are included in the fields
    const sortKeys = fields
      .map(field => getSortKeyFromField(field, undefined))
      .filter((sortKey): sortKey is string => !!sortKey);

    const sort = sorts.find(currentSort => sortKeys.includes(currentSort.field));
    sorts = sort ? [sort] : [];

    const id = props.id !== null && props.id !== void 0 ? String(props.id) : void 0;

    this.id = id;
    this.name = props.name;
    this.fields = fields;
    this.sorts = sorts;
    this.query = typeof props.query === 'string' ? props.query : '';
    this.project = project;
    this.start = props.start;
    this.end = props.end;
    this.statsPeriod = props.statsPeriod;
    this.environment = environment;
    this.yAxis = props.yAxis;
    this.display = props.display;
    this.createdBy = props.createdBy;
  }

  static fromLocation(location: Location): EventView {
    const {start, end, statsPeriod} = getParams(location.query);

    return new EventView({
      id: decodeScalar(location.query.id),
      name: decodeScalar(location.query.name),
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      query: decodeQuery(location) || '',
      project: decodeProjects(location),
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      environment: collectQueryStringByKey(location.query, 'environment'),
      yAxis: decodeScalar(location.query.yAxis),
      display: decodeScalar(location.query.display),
      createdBy: undefined,
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

  static fromSavedQuery(saved: NewQuery | SavedQuery): EventView {
    const fields = saved.fields.map((field, i) => {
      const width =
        saved.widths && saved.widths[i] ? Number(saved.widths[i]) : COL_WIDTH_UNDEFINED;

      return {field, width};
    });
    // normalize datetime selection
    const {start, end, statsPeriod} = getParams({
      start: saved.start,
      end: saved.end,
      statsPeriod: saved.range,
    });

    return new EventView({
      id: saved.id,
      name: saved.name,
      fields,
      query: queryStringFromSavedQuery(saved),
      project: saved.projects,
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      sorts: fromSorts(saved.orderby),
      environment: collectQueryStringByKey(
        {
          environment: saved.environment as string[],
        },
        'environment'
      ),
      yAxis: saved.yAxis,
      display: saved.display,
      createdBy: saved.createdBy,
    });
  }

  isEqualTo(other: EventView): boolean {
    const keys = [
      'id',
      'name',
      'query',
      'statsPeriod',
      'fields',
      'sorts',
      'project',
      'environment',
      'yAxis',
      'display',
    ];

    for (const key of keys) {
      const currentValue = this[key];
      const otherValue = other[key];

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
        const othereDateTime = moment.utc(otherValue);

        if (!currentDateTime.isSame(othereDateTime)) {
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
      yAxis: this.yAxis,
      display: this.display,
    };

    if (!newQuery.query) {
      // if query is an empty string, then it cannot be saved, so we omit it
      // from the payload
      delete newQuery.query;
    }

    return newQuery;
  }

  getGlobalSelection(): {
    start: string | undefined;
    end: string | undefined;
    statsPeriod: string | undefined;
    environment: string[];
    project: number[];
  } {
    return {
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod,
      project: this.project as number[],
      environment: this.environment as string[],
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
      yAxis: this.yAxis,
      display: this.display,
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
    return this.fields.map(field => (field.width ? field.width : COL_WIDTH_UNDEFINED));
  }

  getFields(): string[] {
    return this.fields.map(field => field.field);
  }

  getAggregateFields(): Field[] {
    return this.fields.filter(field => isAggregateField(field.field));
  }

  hasAggregateField() {
    return this.fields.some(field => isAggregateField(field.field));
  }

  numOfColumns(): number {
    return this.fields.length;
  }

  getColumns(): TableColumn<React.ReactText>[] {
    return decodeColumnOrder(this.fields);
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
      project: this.project,
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis,
      display: this.display,
      createdBy: this.createdBy,
    });
  }

  withColumns(columns: Column[]): EventView {
    const newEventView = this.clone();
    const fields: Field[] = columns
      .filter(
        col =>
          (col.kind === 'field' && col.field) ||
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
      queryParts.push(this.query);
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

    const remove = ['id', 'name', 'per_page', 'sort', 'cursor', 'field'];
    for (const key of remove) {
      delete payload[key];
    }

    return payload;
  }

  // Takes an EventView instance and converts it into the format required for the events API
  getEventsAPIPayload(location: Location): EventQuery & LocationQuery {
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
    const normalizedTimeWindowParams = getParams({
      ...dateSelection,
      utc: decodeScalar(query.utc),
    });

    const sort = this.sorts.length > 0 ? encodeSort(this.sorts[0]) : undefined;
    const fields = this.getFields();
    const project = this.project.map(proj => String(proj));
    const environment = this.environment as string[];

    // generate event query
    const eventQuery: EventQuery & LocationQuery = Object.assign(
      omit(picked, DATETIME_QUERY_STRING_KEYS),
      normalizedTimeWindowParams,
      {
        project,
        environment,
        field: [...new Set(fields)],
        sort,
        per_page: DEFAULT_PER_PAGE,
        query: this.query,
      }
    );

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  }

  getResultsViewUrlTarget(slug: string): {pathname: string; query: Query} {
    return {
      pathname: `/organizations/${slug}/discover/results/`,
      query: this.generateQueryStringObject(),
    };
  }

  isFieldSorted(field: Field, tableMeta: MetaType): Sort | undefined {
    const needle = this.sorts.find(sort => isSortEqualToField(sort, field, tableMeta));

    return needle;
  }

  sortOnField(field: Field, tableMeta: MetaType): EventView {
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
      sorts[needleIndex] = reverseSort(currentSort);

      newEventView.sorts = sorts;

      return newEventView;
    }

    // field is currently not sorted; so, we sort on it
    const newEventView = this.clone();

    // invariant: this is not falsey, since sortKey exists
    const sort = fieldToSort(field, tableMeta)!;

    newEventView.sorts = [sort];

    return newEventView;
  }

  getYAxisOptions(): SelectValue<string>[] {
    // Make option set and add the default options in.
    return uniqBy(
      this.getAggregateFields()
        // Exclude last_seen and latest_event as they don't produce useful graphs.
        .filter(
          (field: Field) => ['last_seen', 'latest_event'].includes(field.field) === false
        )
        .map((field: Field) => ({label: field.field, value: field.field}))
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

  getDisplayOptions() {
    if (!this.start && !this.end) {
      return DISPLAY_MODE_OPTIONS;
    }
    return DISPLAY_MODE_OPTIONS.map(item => {
      if (item.value === DisplayModes.PREVIOUS) {
        return {...item, disabled: true};
      }
      return item;
    });
  }
}

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
    const currentTarget = Array.isArray(currentValue)
      ? new Set(currentValue)
      : currentValue;

    const otherValue = other[key];
    const otherTarget = Array.isArray(otherValue) ? new Set(otherValue) : otherValue;

    if (!isEqual(currentTarget, otherTarget)) {
      return false;
    }
  }

  return true;
};

export function pickRelevantLocationQueryStrings(location: Location): LocationQuery {
  const query = location.query || {};
  const picked = pick<LocationQuery>(query || {}, EXTERNAL_QUERY_STRING_KEYS);

  return picked;
}

export default EventView;
