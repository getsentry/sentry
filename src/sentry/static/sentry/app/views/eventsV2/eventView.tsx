import {Location, Query} from 'history';
import {isString, pick} from 'lodash';

import {EventViewv1} from 'app/types';
import {DEFAULT_PER_PAGE} from 'app/constants';

import {AUTOLINK_FIELDS, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';
import {MetaType, EventQuery, getAggregateAlias} from './utils';

type Descending = {
  kind: 'desc';
  field: string;
};

type Ascending = {
  kind: 'asc';
  field: string;
};

type Sort = Descending | Ascending;

type QueryStringField = [
  /* field */ string,
  /* title */ string
  // TODO: implement later
  // /* width */ number
];

type Field = {
  field: string;
  title: string;
  // TODO: implement later
  // width: number;
};

const isValidQueryStringField = (maybe: any): maybe is QueryStringField => {
  if (!Array.isArray(maybe)) {
    return false;
  }

  if (maybe.length !== 2) {
    return false;
  }

  const hasSnubaCol = isString(maybe[0]);
  const hasTitle = isString(maybe[1]);

  // TODO: implement later
  // const hasWidth = typeof maybe[2] === 'number' && isFinite(maybe[2]);
  // TODO: implement later
  // const validTypes = hasSnubaCol && hasTitle && hasWidth;

  const validTypes = hasSnubaCol && hasTitle;

  return validTypes;
};

const decodeFields = (location: Location): Array<Field> => {
  const {query} = location;

  if (!query || !query.field) {
    return [];
  }

  const fields: Array<string> = isString(query.field) ? [query.field] : query.field;

  return fields.reduce((acc: Array<Field>, field: string) => {
    try {
      const result = JSON.parse(field);

      if (isValidQueryStringField(result)) {
        field = result[0].trim();
        if (field.length > 0) {
          acc.push({
            field,
            title: result[1],
          });
        }

        return acc;
      }
    } catch (_err) {
      // no-op
    }

    return acc;
  }, []);
};

export const encodeFields = (fields: Array<Field>): Array<string> => {
  return fields.map(field => {
    return JSON.stringify([field.field, field.title]);
  });
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
      throw new Error('unexpected sort type');
    }
  }
};

const encodeSorts = (sorts: Array<Sort>): Array<string> => {
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
    return void 0;
  }

  const queryParameter = location.query.query;

  const query =
    Array.isArray(queryParameter) && queryParameter.length > 0
      ? queryParameter[0]
      : isString(queryParameter)
      ? queryParameter
      : void 0;

  return isString(query) ? query.trim() : undefined;
};

class EventView {
  fields: Field[];
  sorts: Sort[];
  tags: string[];
  query: string | undefined;

  constructor(props: {
    fields: Field[];
    sorts: Sort[];
    tags: string[];
    query?: string | undefined;
  }) {
    this.fields = props.fields;
    this.sorts = props.sorts;
    this.tags = props.tags;
    this.query = props.query;
  }

  static fromLocation(location: Location): EventView {
    return new EventView({
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      tags: decodeTags(location),
      query: decodeQuery(location),
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
      sorts: fromSorts(eventViewV1.data.sort),
      tags: eventViewV1.tags,
      query: eventViewV1.data.query,
    });
  }

  generateQueryStringObject(): Query {
    return {
      field: encodeFields(this.fields),
      sort: encodeSorts(this.sorts),
      tag: this.tags,
      query: this.query,
    };
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

    const fieldNames = this.getFieldNames();

    const defaultSort = fieldNames.length > 0 ? [fieldNames[0]] : undefined;

    const eventQuery: EventQuery = Object.assign(picked, {
      field: [...new Set(fieldNames)],
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
