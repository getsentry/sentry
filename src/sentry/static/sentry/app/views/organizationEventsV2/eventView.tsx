import {Location} from 'history';
import {isString} from 'lodash';

type Descending = {
  kind: 'desc';
  snuba_col: string;
};

type Ascending = {
  kind: 'asc';
  snuba_col: string;
};

type Sort = Descending | Ascending;

type QueryStringField = [
  /* snuba_column */ string,
  /* title */ string,
  /* width */ number
];

type Field = {
  snuba_column: string;
  title: string;
  width: number;
};

const isValidQueryStringField = (maybe: any): maybe is QueryStringField => {
  if (!Array.isArray(maybe)) {
    return false;
  }

  if (maybe.length !== 3) {
    return false;
  }

  const hasSnubaCol = isString(maybe[0]);
  const hasTitle = isString(maybe[1]);
  const hasWidth = typeof maybe[2] === 'number' && isFinite(maybe[2]);

  const validTypes = hasSnubaCol && hasTitle && hasWidth;

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
        const snuba_column = result[0].trim();

        if (snuba_column.length > 0) {
          acc.push({
            snuba_column,
            title: result[1],
            width: result[2],
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

const decodeSorts = (location): Array<Sort> => {
  const {query} = location;

  if (!query || !query.sort) {
    return [];
  }

  const sorts: Array<string> = isString(query.sort) ? [query.sort] : query.sort;

  return sorts.reduce((acc: Array<Sort>, sort: string) => {
    sort = sort.trim();

    if (sort.startsWith('-')) {
      acc.push({
        kind: 'desc',
        snuba_col: sort.substring(1),
      });
      return acc;
    }

    acc.push({
      kind: 'asc',
      snuba_col: sort,
    });

    return acc;
  }, []);
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

  constructor(location: Location) {
    this.fields = decodeFields(location);
    this.sorts = decodeSorts(location);
    this.tags = decodeTags(location);
    this.query = decodeQuery(location);
  }
}

export default EventView;
