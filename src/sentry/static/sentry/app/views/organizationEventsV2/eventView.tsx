import {Location} from 'history';
import {isString} from 'lodash';

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

class EventView {
  fields: Field[];

  constructor(location: Location) {
    this.fields = decodeFields(location);
  }
}

export default EventView;
