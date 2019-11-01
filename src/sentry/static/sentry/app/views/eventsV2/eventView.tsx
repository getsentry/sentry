import {Location, Query} from 'history';
import {isString, cloneDeep, pick, isEqual} from 'lodash';
import moment from 'moment';

import {DEFAULT_PER_PAGE} from 'app/constants';
import {EventViewv1} from 'app/types';
import {SavedQuery as LegacySavedQuery} from 'app/views/discover/types';
import {SavedQuery, NewQuery} from 'app/stores/discoverSavedQueriesStore';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

import {AUTOLINK_FIELDS, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';
import {
  MetaType,
  EventQuery,
  isAggregateField,
  getAggregateAlias,
  decodeColumnOrder,
} from './utils';
import {TableColumn, TableColumnSort} from './table/types';

type LocationQuery = {
  project?: string | string[];
  environment?: string | string[];
  start?: string | string[];
  end?: string | string[];
  utc?: string | string[];
  statsPeriod?: string | string[];
  cursor?: string | string[];
  yAxis?: string | string[];
};

const EXTERNAL_QUERY_STRING_KEYS: Readonly<Array<keyof LocationQuery>> = [
  'project',
  'environment',
  'start',
  'end',
  'utc',
  'statsPeriod',
  'cursor',
];

export type Sort = {
  kind: 'asc' | 'desc';
  field: string;
};

const reverseSort = (sort: Sort): Sort => {
  return {
    kind: sort.kind === 'desc' ? 'asc' : 'desc',
    field: sort.field,
  };
};

export type Field = {
  field: string;
  title: string;
  // TODO: implement later
  // width: number;
};

const isSortEqualToField = (
  sort: Sort,
  field: Field,
  tableDataMeta: MetaType
): boolean => {
  const sortKey = getSortKeyFromField(field, tableDataMeta);
  return sort.field === sortKey;
};

const fieldToSort = (field: Field, tableDataMeta: MetaType): Sort | undefined => {
  const sortKey = getSortKeyFromField(field, tableDataMeta);

  if (!sortKey) {
    return void 0;
  }

  return {
    kind: 'desc',
    field: sortKey,
  };
};

function getSortKeyFromFieldWithoutMeta(field: Field): string | null {
  const column = getAggregateAlias(field.field);
  if (SPECIAL_FIELDS.hasOwnProperty(column)) {
    return SPECIAL_FIELDS[column as keyof typeof SPECIAL_FIELDS].sortField;
  }

  return column;
}

function getSortKeyFromField(field: Field, tableDataMeta: MetaType): string | null {
  const column = getAggregateAlias(field.field);
  if (SPECIAL_FIELDS.hasOwnProperty(column)) {
    return SPECIAL_FIELDS[column as keyof typeof SPECIAL_FIELDS].sortField;
  }

  if (FIELD_FORMATTERS.hasOwnProperty(tableDataMeta[column])) {
    return FIELD_FORMATTERS[tableDataMeta[column] as keyof typeof FIELD_FORMATTERS]
      .sortField
      ? column
      : null;
  }

  return null;
}

export function isFieldSortable(field: Field, tableDataMeta: MetaType): boolean {
  return !!getSortKeyFromField(field, tableDataMeta);
}

const generateFieldAsString = (props: {aggregation: string; field: string}): string => {
  const {aggregation, field} = props;

  const hasAggregation = aggregation.length > 0;

  const fieldAsString = hasAggregation ? `${aggregation}(${field})` : field;

  return fieldAsString;
};

const decodeFields = (location: Location): Array<Field> => {
  const {query} = location;

  if (!query || !query.field) {
    return [];
  }

  const fields: string[] = isString(query.field) ? [query.field] : query.field;
  const fieldnames: string[] = Array.isArray(query.fieldnames)
    ? query.fieldnames
    : isString(query.fieldnames)
    ? [query.fieldnames]
    : [];

  const parsed: Field[] = [];
  fields.forEach((field, i) => {
    let title = field;
    if (fieldnames[i]) {
      title = fieldnames[i];
    }
    parsed.push({field, title});
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

const encodeSorts = (sorts: Readonly<Array<Sort>>): Array<string> => {
  return sorts.map(encodeSort);
};

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

const decodeScalar = (
  value: string[] | string | undefined | null
): string | undefined => {
  if (!value) {
    return undefined;
  }
  const unwrapped =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : isString(value)
      ? value
      : undefined;
  return isString(unwrapped) ? unwrapped : undefined;
};

function isLegacySavedQuery(
  query: LegacySavedQuery | SavedQuery
): query is LegacySavedQuery {
  return (query as LegacySavedQuery).conditions !== undefined;
}

const queryStringFromSavedQuery = (saved: LegacySavedQuery | SavedQuery): string => {
  if (!isLegacySavedQuery(saved) && saved.query) {
    return saved.query || '';
  }
  if (isLegacySavedQuery(saved) && saved.conditions) {
    const conditions = saved.conditions.map(item => {
      const [field, op, value] = item;
      let operator = op;
      // TODO handle all the other operator types
      if (operator === '=') {
        operator = '';
      }
      return field + ':' + operator + value;
    });
    return conditions.join(' ');
  }
  return '';
};

class EventView {
  id: string | undefined;
  name: string | undefined;
  fields: Readonly<Field[]>;
  sorts: Readonly<Sort[]>;
  tags: Readonly<string[]>;
  query: string;
  project: Readonly<number[]>;
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
  environment: Readonly<string[]>;
  yAxis: string | undefined;

  constructor(props: {
    id: string | undefined;
    name: string | undefined;
    fields: Readonly<Field[]>;
    sorts: Readonly<Sort[]>;
    tags: Readonly<string[]>;
    query: string;
    project: Readonly<number[]>;
    start: string | undefined;
    end: string | undefined;
    statsPeriod: string | undefined;
    environment: Readonly<string[]>;
    yAxis: string | undefined;
  }) {
    // only include sort keys that are included in the fields

    const sortKeys = props.fields
      .map(field => {
        return getSortKeyFromFieldWithoutMeta(field);
      })
      .filter(
        (sortKey): sortKey is string => {
          return !!sortKey;
        }
      );

    const sort = props.sorts.find(currentSort => {
      return sortKeys.includes(currentSort.field);
    });

    const sorts = sort ? [sort] : [];

    const id = props.id !== null && props.id !== void 0 ? String(props.id) : void 0;

    this.id = id;
    this.name = props.name;
    this.fields = props.fields;
    this.sorts = sorts;
    this.tags = props.tags;
    this.query = typeof props.query === 'string' ? props.query : '';
    this.project = props.project;
    this.start = props.start;
    this.end = props.end;
    this.statsPeriod = props.statsPeriod;
    this.environment = props.environment;
    this.yAxis = props.yAxis;
  }

  static fromLocation(location: Location): EventView {
    const {start, end, statsPeriod} = getParams(location.query);

    return new EventView({
      id: decodeScalar(location.query.id),
      name: decodeScalar(location.query.name),
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      tags: collectQueryStringByKey(location.query, 'tag'),
      query: decodeQuery(location) || '',
      project: decodeProjects(location),
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      environment: collectQueryStringByKey(location.query, 'environment'),
      yAxis: decodeScalar(location.query.yAxis),
    });
  }

  static fromEventViewv1(eventViewV1: EventViewv1): EventView {
    const fields = eventViewV1.data.fields.map((fieldName: string, index: number) => {
      return {
        field: fieldName,
        title: eventViewV1.data.fieldnames[index],
      };
    });

    return new EventView({
      fields,
      name: eventViewV1.name,
      sorts: fromSorts(eventViewV1.data.sort),
      tags: eventViewV1.tags,
      query: eventViewV1.data.query || '',
      project: [],
      id: undefined,
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: [],
      yAxis: undefined,
    });
  }

  static fromSavedQuery(saved: SavedQuery | LegacySavedQuery): EventView {
    let fields, yAxis;
    if (isLegacySavedQuery(saved)) {
      fields = saved.fields.map(field => {
        return {field, title: field};
      });
      yAxis = undefined;
    } else {
      fields = saved.fields.map((field, i) => {
        const title =
          saved.fieldnames && saved.fieldnames[i] ? saved.fieldnames[i] : field;
        return {field, title};
      });
      yAxis = saved.yAxis;
    }

    // normalize datetime selection

    const {start, end, statsPeriod} = getParams({
      start: saved.start,
      end: saved.end,
      statsPeriod: saved.range,
    });

    return new EventView({
      fields,
      id: saved.id,
      name: saved.name,
      query: queryStringFromSavedQuery(saved),
      project: saved.projects,
      start: decodeScalar(start),
      end: decodeScalar(end),
      statsPeriod: decodeScalar(statsPeriod),
      sorts: fromSorts(saved.orderby),
      tags: collectQueryStringByKey(
        {
          tags: (saved as SavedQuery).tags as string[],
        },
        'tags'
      ),
      environment: collectQueryStringByKey(
        {
          environment: (saved as SavedQuery).environment as string[],
        },
        'environment'
      ),
      yAxis,
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
      'tags',
      'project',
      'environment',
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
      fieldnames: this.getFieldNames(),
      orderby,
      tags: this.tags,
      query: this.query || '',
      projects: this.project,
      start: this.start,
      end: this.end,
      range: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis,
    };

    if (!newQuery.query) {
      // if query is an empty string, then it cannot be saved, so we omit it
      // from the payload
      delete newQuery.query;
    }

    return newQuery;
  }

  generateQueryStringObject(): Query {
    const output = {
      id: this.id,
      name: this.name,
      field: this.getFields(),
      fieldnames: this.getFieldNames(),
      sort: encodeSorts(this.sorts),
      tag: this.tags,
      query: this.query,
      yAxis: this.yAxis,
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

  getFieldNames(): string[] {
    return this.fields.map(field => {
      return field.title;
    });
  }

  getFields(): string[] {
    return this.fields.map(field => {
      return field.field;
    });
  }

  getAggregateFields(): Field[] {
    return this.fields.filter(field => isAggregateField(field.field));
  }

  /**
   * Check if the field set contains no automatically linked fields
   */
  hasAutolinkField(): boolean {
    return this.fields.some(field => {
      return AUTOLINK_FIELDS.includes(field.field);
    });
  }

  numOfColumns(): number {
    return this.fields.length;
  }

  getColumns(): TableColumn<React.ReactText>[] {
    return decodeColumnOrder({
      field: this.getFields(),
      fieldnames: this.getFieldNames(),
      fields: this.fields,
    });
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
      tags: this.tags,
      query: this.query,
      project: this.project,
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis,
    });
  }

  withNewColumn(newColumn: {
    aggregation: string;
    field: string;
    fieldname: string;
  }): EventView {
    const field = newColumn.field.trim();

    const aggregation = newColumn.aggregation.trim();

    const fieldAsString = generateFieldAsString({field, aggregation});

    const name = newColumn.fieldname.trim();
    const hasName = name.length > 0;

    const newField: Field = {
      field: fieldAsString,
      title: hasName ? name : fieldAsString,
    };

    const newEventView = this.clone();

    newEventView.fields = [...newEventView.fields, newField];

    return newEventView;
  }

  withNewColumnAt(
    newColumn: {
      aggregation: string;
      field: string;
      fieldname: string;
    },
    insertIndex: number
  ): EventView {
    const newEventView = this.withNewColumn(newColumn);

    const fromIndex = newEventView.fields.length - 1;

    return newEventView.withMovedColumn({fromIndex, toIndex: insertIndex});
  }

  withUpdatedColumn(
    columnIndex: number,
    updatedColumn: {
      aggregation: string;
      field: string;
      fieldname: string;
    },
    tableDataMeta: MetaType
  ): EventView {
    const {field, aggregation, fieldname} = updatedColumn;

    const columnToBeUpdated = this.fields[columnIndex];

    const fieldAsString = generateFieldAsString({field, aggregation});

    const updateField = columnToBeUpdated.field !== fieldAsString;
    const updateFieldName = columnToBeUpdated.title !== fieldname;

    if (!updateField && !updateFieldName) {
      return this;
    }

    const newEventView = this.clone();

    const updatedField: Field = {
      field: fieldAsString,
      title: fieldname,
    };

    const fields = [...newEventView.fields];
    fields[columnIndex] = updatedField;

    newEventView.fields = fields;

    // if the updated column is one of the sorted columns, we may need to remove
    // it from the list of sorts

    const needleSortIndex = this.sorts.findIndex(sort => {
      return isSortEqualToField(sort, columnToBeUpdated, tableDataMeta);
    });

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];

      const numOfColumns = this.fields.reduce((sum, currentField) => {
        if (isSortEqualToField(needleSort, currentField, tableDataMeta)) {
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
      }

      if (newEventView.sorts.length <= 0 && newEventView.fields.length > 0) {
        // establish a default sort by finding the first sortable field

        if (isFieldSortable(updatedField, tableDataMeta)) {
          // use the current updated field as the sort key
          const sort = fieldToSort(updatedField, tableDataMeta)!;

          // preserve the sort kind
          sort.kind = needleSort.kind;

          newEventView.sorts = [sort];
        } else {
          const sortableFieldIndex = newEventView.fields.findIndex(currentField => {
            return isFieldSortable(currentField, tableDataMeta);
          });
          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableDataMeta)!;
            newEventView.sorts = [sort];
          }
        }
      }
    }

    return newEventView;
  }

  withDeletedColumn(columnIndex: number, tableDataMeta: MetaType): EventView {
    // Disallow removal of the orphan column, and check for out-of-bounds
    if (this.fields.length <= 1 || this.fields.length <= columnIndex || columnIndex < 0) {
      return this;
    }

    // delete the column

    const newEventView = this.clone();

    const fields = [...newEventView.fields];
    fields.splice(columnIndex, 1);
    newEventView.fields = fields;

    // if the deleted column is one of the sorted columns, we need to remove
    // it from the list of sorts

    const columnToBeDeleted = this.fields[columnIndex];

    const needleSortIndex = this.sorts.findIndex(sort => {
      return isSortEqualToField(sort, columnToBeDeleted, tableDataMeta);
    });

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];

      const numOfColumns = this.fields.reduce((sum, field) => {
        if (isSortEqualToField(needleSort, field, tableDataMeta)) {
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

          const sortableFieldIndex = newEventView.fields.findIndex(field => {
            return isFieldSortable(field, tableDataMeta);
          });

          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableDataMeta)!;
            newEventView.sorts = [sort];
          }
        }
      }
    }

    return newEventView;
  }

  withMovedColumn({fromIndex, toIndex}: {fromIndex: number; toIndex: number}): EventView {
    if (fromIndex === toIndex) {
      return this;
    }

    const newEventView = this.clone();

    const fields = [...newEventView.fields];

    fields.splice(toIndex, 0, fields.splice(fromIndex, 1)[0]);

    newEventView.fields = fields;

    return newEventView;
  }

  getSorts(): TableColumnSort<React.ReactText>[] {
    return this.sorts.map(sort => {
      return {
        key: sort.field,
        order: sort.kind,
      } as TableColumnSort<string>;
    });
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

  getTagsAPIPayload(
    location: Location
  ): Exclude<EventQuery & LocationQuery, 'sort' | 'cursor'> {
    const payload = this.getEventsAPIPayload(location);

    if (payload.sort) {
      delete payload.sort;
    }

    if (payload.cursor) {
      delete payload.cursor;
    }

    return payload;
  }

  // Takes an EventView instance and converts it into the format required for the events API
  getEventsAPIPayload(location: Location): EventQuery & LocationQuery {
    const query = (location && location.query) || {};

    // pick only the query strings that we care about

    const picked = pickRelevantLocationQueryStrings(location);

    // normalize datetime selection

    const normalizedTimeWindowParams = getParams({
      start: this.start,
      end: this.end,
      period: decodeScalar(query.period),
      statsPeriod: this.statsPeriod,
      utc: decodeScalar(query.utc),
    });

    const sort = this.sorts.length > 0 ? encodeSort(this.sorts[0]) : undefined;
    const fields = this.getFields();

    // generate event query

    const eventQuery: EventQuery & LocationQuery = Object.assign(
      picked,
      normalizedTimeWindowParams,
      {
        field: [...new Set(fields)],
        sort,
        per_page: DEFAULT_PER_PAGE,
        query: this.getQuery(query.query),
      }
    );

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  }

  isFieldSorted(field: Field, tableDataMeta: MetaType): Sort | undefined {
    const needle = this.sorts.find(sort => {
      return isSortEqualToField(sort, field, tableDataMeta);
    });

    return needle;
  }

  sortOnField(field: Field, tableDataMeta: MetaType): EventView {
    // check if field can be sorted
    if (!isFieldSortable(field, tableDataMeta)) {
      return this;
    }

    const needleIndex = this.sorts.findIndex(sort => {
      return isSortEqualToField(sort, field, tableDataMeta);
    });

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
    const sort = fieldToSort(field, tableDataMeta)!;

    newEventView.sorts = [sort];

    return newEventView;
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
