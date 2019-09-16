import {Location, Query} from 'history';
import {isString, cloneDeep, pick, get, isPlainObject} from 'lodash';

import {EventViewv1} from 'app/types';
import {SavedQuery} from 'app/views/discover/types';
import {DEFAULT_PER_PAGE} from 'app/constants';

import {AUTOLINK_FIELDS, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';
import {MetaType, EventQuery, getAggregateAlias, getFirstQueryString} from './utils';

type Descending = {
  kind: 'desc';
  field: string;
};

type Ascending = {
  kind: 'asc';
  field: string;
};

type Sort = Descending | Ascending;

type Field = {
  field: string;
  title: string;
  // TODO: implement later
  // width: number;
};

const isField = (input: any): input is Field => {
  if (!isPlainObject(input)) {
    return false;
  }

  return isString(input.field) && isString(input.title);
};

type DiscoverState = {
  fields: Field[];
  sorts: string[];
  tags: string[];
};

const parseFields = (maybe: any): Field[] => {
  if (!Array.isArray(maybe)) {
    return [];
  }

  return maybe.filter(isField);
};

const parseStringArray = (maybe: any): string[] => {
  if (!Array.isArray(maybe)) {
    return [];
  }

  return maybe.filter(isString);
};

const intoDiscoverState = (location: Location): DiscoverState => {
  try {
    const maybeState: string = getFirstQueryString(location.query, 'state', '{}');
    const result = JSON.parse(maybeState);

    return {
      fields: parseFields(get(result, 'fields', [])),
      sorts: parseStringArray(get(result, 'sorts', [])),
      tags: parseStringArray(get(result, 'tags', [])),
    };
  } catch (_err) {
    return {
      fields: [],
      sorts: [],
      tags: [],
    };
  }
};

const fromSorts = (sorts: Array<string>): Array<Sort> => {
  return sorts.reduce((acc: Array<Sort>, sort: string) => {
    sort = sort.trim();

    if (sort.startsWith('-')) {
      acc.push({
        kind: 'desc',
        field: sort.substring(1),
      });
      return acc;
    }

    acc.push({
      kind: 'asc',
      field: sort,
    });

    return acc;
  }, []);
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
      throw new Error('unexpected sort type');
    }
  }
};

const encodeSorts = (sorts: Array<Sort>): Array<string> => {
  return sorts.map(encodeSort);
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
    return void 0;
  }
  const unwrapped =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : isString(value)
      ? value
      : void 0;
  return isString(unwrapped) ? unwrapped : void 0;
};

const queryStringFromSavedQuery = (saved: SavedQuery): string => {
  if (saved.query) {
    return saved.query;
  }
  if (saved.conditions) {
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
  name: string | undefined;
  fields: Field[];
  sorts: Sort[];
  tags: string[];
  query: string | undefined;
  project: number[];
  range: string | undefined;
  start: string | undefined;
  end: string | undefined;

  constructor(props: {
    name: string | undefined;
    fields: Field[];
    sorts: Sort[];
    tags: string[];
    query?: string | undefined;
    project: number[];
    range: string | undefined;
    start: string | undefined;
    end: string | undefined;
  }) {
    this.name = props.name;
    this.fields = props.fields;
    this.sorts = props.sorts;
    this.tags = props.tags;
    this.query = props.query;
    this.project = props.project;
    this.range = props.range;
    this.start = props.start;
    this.end = props.end;
  }

  static fromLocation(location: Location): EventView {
    const discoverState = intoDiscoverState(location);

    return new EventView({
      name: decodeScalar(location.query.name),
      fields: discoverState.fields,
      sorts: fromSorts(discoverState.sorts),
      tags: discoverState.tags,
      query: decodeScalar(location.query.query),
      project: decodeProjects(location),
      start: decodeScalar(location.query.start),
      end: decodeScalar(location.query.end),
      range: decodeScalar(location.query.range),
    });
  }

  static fromEventViewv1(eventViewV1: EventViewv1): EventView {
    const fields = eventViewV1.data.fields.map((fieldName: string, index: number) => {
      return {
        field: fieldName,
        title: eventViewV1.data.columnNames[index],
      };
    });

    return new EventView({
      fields,
      name: eventViewV1.name,
      sorts: fromSorts(eventViewV1.data.sort),
      tags: eventViewV1.tags,
      query: eventViewV1.data.query,
      project: [],
      range: undefined,
      start: undefined,
      end: undefined,
    });
  }

  static fromSavedQuery(saved: SavedQuery): EventView {
    const fields = saved.fields.map(field => {
      return {field, title: field};
    });

    return new EventView({
      fields,
      name: saved.name,
      query: queryStringFromSavedQuery(saved),
      project: saved.projects,
      start: saved.start,
      end: saved.end,
      range: saved.range,
      sorts: [],
      tags: [],
    });
  }

  generateQueryStringObject(): Query {
    const state: DiscoverState = {
      fields: this.fields,
      sorts: encodeSorts(this.sorts),
      tags: this.tags,
    };

    const output = {
      state: JSON.stringify(state),
      query: this.query,
    };

    const conditionalFields = ['name', 'project', 'start', 'end', 'range'] as const;
    for (const field of conditionalFields) {
      if (this[field] && this[field]!.length) {
        output[field] = this[field];
      }
    }

    return cloneDeep(output);
  }

  isValid(): boolean {
    return this.fields.length > 0;
  }

  getFieldTitles(): string[] {
    return this.fields.map(field => {
      return field.title;
    });
  }

  getFieldNames(): string[] {
    return this.fields.map(field => {
      return field.field;
    });
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

  getQuery(inputQuery: string | string[] | null | undefined): string {
    const queryParts: Array<string> = [];

    if (this.query) {
      queryParts.push(this.query);
    }

    if (inputQuery) {
      // there may be duplicate query in the query string
      // e.g. query=hello&query=world
      if (Array.isArray(inputQuery)) {
        inputQuery.forEach(query => {
          if (typeof query === 'string') {
            queryParts.push(query);
          }
        });
      }

      if (typeof inputQuery === 'string') {
        queryParts.push(inputQuery);
      }
    }

    return queryParts.join(' ');
  }

  getEventsAPIPayload(location: Location): EventQuery {
    const query = location.query || {};

    type LocationQuery = {
      project?: string;
      environment?: string;
      start?: string;
      end?: string;
      utc?: string;
      statsPeriod?: string;
      cursor?: string;
    };

    const picked = pick<LocationQuery>(query || {}, [
      'project',
      'environment',
      'start',
      'end',
      'utc',
      'statsPeriod',
      'cursor',
    ]);

    const fieldNames = this.getFieldNames();

    const defaultSort = fieldNames.length > 0 ? [fieldNames[0]] : undefined;
    const encodedSorts = encodeSorts(this.sorts);

    const eventQuery: EventQuery = Object.assign(picked, {
      field: [...new Set(fieldNames)],
      sort: encodedSorts.length > 0 ? encodedSorts : defaultSort,
      per_page: DEFAULT_PER_PAGE,
      query: this.getQuery(query.query),
    });

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  }

  getDefaultSort(): string | undefined {
    if (this.sorts.length <= 0) {
      return void 0;
    }

    return encodeSort(this.sorts[0]);
  }

  getSortKey(fieldname: string, meta: MetaType): string | null {
    const column = getAggregateAlias(fieldname);
    if (SPECIAL_FIELDS.hasOwnProperty(column)) {
      return SPECIAL_FIELDS[column as keyof typeof SPECIAL_FIELDS].sortField;
    }

    if (FIELD_FORMATTERS.hasOwnProperty(meta[column])) {
      return FIELD_FORMATTERS[meta[column] as keyof typeof FIELD_FORMATTERS].sortField
        ? column
        : null;
    }

    return null;
  }
}

export default EventView;
