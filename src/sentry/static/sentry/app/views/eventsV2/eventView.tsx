import {Location, Query} from 'history';
import {isString, cloneDeep, pick} from 'lodash';

import {DEFAULT_PER_PAGE} from 'app/constants';
import {EventViewv1} from 'app/types';
import {SavedQuery as LegacySavedQuery} from 'app/views/discover/types';
import {SavedQuery, NewQuery} from 'app/stores/discoverSavedQueriesStore';

import {AUTOLINK_FIELDS, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';
import {MetaType, EventQuery, getAggregateAlias, decodeColumnOrder} from './utils';
import {TableColumn, TableColumnSort} from './table/types';

export type Sort = {
  kind: 'asc' | 'desc';
  field: string;
};

export type Field = {
  field: string;
  title: string;
  // TODO: implement later
  // width: number;
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

  return sorts.reduce((acc: Array<Sort>, sort: string) => {
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

const decodeTags = (location: Location): Array<string> => {
  const {query} = location;

  if (!query || !query.tag) {
    return [];
  }

  const tags: Array<string> = isString(query.tag) ? [query.tag] : query.tag;

  return tags.reduce((acc: Array<string>, tag: string) => {
    tag = tag.trim();

    if (tag.length > 0) {
      acc.push(tag);
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
    return saved.query;
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
  query: string | undefined;
  project: Readonly<number[]>;
  range: string | undefined;
  start: string | undefined;
  end: string | undefined;

  constructor(props: {
    id: string | undefined;
    name: string | undefined;
    fields: Readonly<Field[]>;
    sorts: Readonly<Sort[]>;
    tags: Readonly<string[]>;
    query?: string | undefined;
    project: Readonly<number[]>;
    range: string | undefined;
    start: string | undefined;
    end: string | undefined;
  }) {
    this.id = props.id;
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
    return new EventView({
      id: decodeScalar(location.query.id),
      name: decodeScalar(location.query.name),
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      tags: decodeTags(location),
      query: decodeQuery(location),
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
        title: eventViewV1.data.fieldnames[index],
      };
    });

    return new EventView({
      fields,
      name: eventViewV1.name,
      sorts: fromSorts(eventViewV1.data.sort),
      tags: eventViewV1.tags,
      query: eventViewV1.data.query,
      project: [],
      id: undefined,
      range: undefined,
      start: undefined,
      end: undefined,
    });
  }

  static fromSavedQuery(saved: SavedQuery | LegacySavedQuery): EventView {
    let fields;
    if (isLegacySavedQuery(saved)) {
      fields = saved.fields.map(field => {
        return {field, title: field};
      });
    } else {
      fields = saved.fields.map((field, i) => {
        const title =
          saved.fieldnames && saved.fieldnames[i] ? saved.fieldnames[i] : field;
        return {field, title};
      });
    }

    return new EventView({
      fields,
      id: saved.id,
      name: saved.name,
      query: queryStringFromSavedQuery(saved),
      project: saved.projects,
      start: saved.start,
      end: saved.end,
      range: saved.range,
      sorts: fromSorts(saved.orderby),
      tags: [],
    });
  }

  toNewQuery(): NewQuery {
    const orderby = this.sorts ? encodeSorts(this.sorts)[0] : undefined;
    return {
      id: this.id,
      version: 2,
      name: this.name || '',
      query: this.query || '',
      projects: this.project,
      start: this.start,
      end: this.end,
      range: this.range,
      fields: this.fields.map(item => item.field),
      fieldnames: this.fields.map(item => item.title),
      orderby,
    };
  }

  generateQueryStringObject(): Query {
    const output = {
      id: this.id,
      field: this.fields.map(item => item.field),
      fieldnames: this.fields.map(item => item.title),
      sort: encodeSorts(this.sorts),
      tag: this.tags,
      query: this.query,
    };
    const conditionalFields = ['name', 'project', 'start', 'end', 'range'];
    for (const field of conditionalFields) {
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
      range: this.range,
      start: this.start,
      end: this.end,
    });
  }
  getSorts(): TableColumnSort<React.ReactText>[] {
    return this.sorts.map(sort => {
      return {
        key: sort.field,
        order: sort.kind,
      } as TableColumnSort<string>;
    });
  }

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

  // Takes an EventView instance and converts it into the format required for the events API
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
      sort?: string;
    };

    const picked = pick<LocationQuery>(query || {}, [
      'project',
      'environment',
      'start',
      'end',
      'utc',
      'statsPeriod',
      'cursor',
      'sort',
    ]);

    const fields = this.getFields();

    const defaultSort = fields.length > 0 ? [fields[0]] : undefined;

    const eventQuery: EventQuery = Object.assign(picked, {
      field: [...new Set(fields)],
      sort: picked.sort ? picked.sort : defaultSort,
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
      return undefined;
    }

    return encodeSort(this.sorts[0]);
  }

  getSortKey(fieldname: string, tableDataMeta: MetaType): string | null {
    const column = getAggregateAlias(fieldname);
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
}

export default EventView;
