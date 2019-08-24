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

  const validTypes =
    isString(maybe[0]) &&
    isString(maybe[1]) &&
    typeof maybe[2] === 'number' &&
    isFinite(maybe[2]);

  return validTypes;
};

const decodeFields = (location: Location): Array<Field> => {
  const {query} = location;

  if (!query || !query.field) {
    return [];
  }

  const field: Array<string> = isString(query.field) ? [query.field] : query.field;

  return field.reduce((acc: Array<Field>, field: string) => {
    try {
      const result = JSON.parse(field);

      if (isValidQueryStringField(result)) {
        acc.push({
          snuba_column: result[0],
          title: result[1],
          width: result[2],
        });
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

  const sort: Array<string> = isString(query.sort) ? [query.sort] : query.sort;

  return sort.reduce((acc: Array<Sort>, sort: string) => {
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

class EventView {
  fields: Field[];
  sorts: Sort[];

  constructor(location: Location) {
    this.fields = decodeFields(location);
    this.sorts = decodeSorts(location);
  }
}

export default EventView;
