/**
 * Converts a stream query to an object representation, with
 * keys representing tag names, and the magic __text key
 * representing the text component of the search.
 *
 * Example:
 *
 * "python is:unresolved assigned:foo@bar.com"
 * => {
 *      __text: "python",
 *      is: "unresolved",
 *      assigned: "foo@bar.com"
 *    }
 */

export type QueryObj = {
  [key: string]: string;
};

export function queryToObj(queryStr = ''): QueryObj {
  const text: string[] = [];

  const queryItems = queryStr.match(/\S+:"[^"]*"?|\S+/g);
  const queryObj: QueryObj = (queryItems || []).reduce((obj, item) => {
    const index = item.indexOf(':');
    if (index === -1) {
      text.push(item);
    } else {
      const tagKey = item.slice(0, index);
      const value = item.slice(index + 1).replace(/^"|"$/g, '');
      obj[tagKey] = value;
    }
    return obj;
  }, {});

  queryObj.__text = '';
  if (text.length) {
    queryObj.__text = text.join(' ');
  }

  return queryObj;
}

/**
 * Converts an object representation of a stream query to a string
 * (consumable by the Sentry stream HTTP API).
 */
export function objToQuery(queryObj: QueryObj): string {
  const {__text, ...tags} = queryObj;

  const parts = Object.entries(tags).map(([tagKey, value]) => {
    if (value.indexOf(' ') > -1) {
      value = `"${value}"`;
    }

    return `${tagKey}:${value}`;
  });

  if (queryObj.__text) {
    parts.push(queryObj.__text);
  }

  return parts.join(' ');
}
