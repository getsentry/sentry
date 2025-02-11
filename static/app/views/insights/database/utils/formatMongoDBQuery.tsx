import type {ReactElement} from 'react';
import * as Sentry from '@sentry/react';
import {jsonrepair} from 'jsonrepair';

type JSONValue = string | number | Record<PropertyKey, unknown> | boolean | null;

/**
 * Takes in a MongoDB query JSON string and outputs it as HTML tokens.
 * Performs some processing to surface the DB operation and collection so they are the first key-value
 * pair in the query, and **bolds** the operation
 *
 * @param query The query as a JSON string
 * @param command The DB command, e.g. `find`. This is available as a tag on database spans
 */
export function formatMongoDBQuery(query: string, command: string) {
  const sentrySpan = Sentry.startInactiveSpan({
    op: 'function',
    name: 'formatMongoDBQuery',
    attributes: {
      query,
      command,
    },
    onlyIfParent: true,
  });

  let queryObject: Record<string, JSONValue> = {};
  try {
    queryObject = JSON.parse(query);
  } catch {
    try {
      const repairedJson = jsonrepair(query);
      queryObject = JSON.parse(repairedJson);
    } catch {
      return query;
    }
  }

  const tokens: ReactElement[] = [];
  const tempTokens: ReactElement[] = [];

  const queryEntries = Object.entries(queryObject);
  queryEntries.forEach(([key, val]) => {
    const isBoldedEntry = key.toLowerCase() === command.toLowerCase();

    // Push the bolded entry into tokens so it is the first entry displayed.
    // The other tokens will be pushed into tempTokens, and then copied into tokens afterwards
    if (isBoldedEntry) {
      tokens.push(jsonEntryToToken(key, val, true));
    } else {
      tempTokens.push(jsonEntryToToken(key, val));
    }
  });

  if (tokens.length === 1 && tempTokens.length > 0) {
    tokens.push(stringToToken(', ', `${tokens[0]!.key}:,`));
  }

  tempTokens.forEach((token, index) => {
    tokens.push(token);

    if (index !== tempTokens.length - 1) {
      tokens.push(stringToToken(', ', `${token.key}:${index}`));
    }
  });

  sentrySpan.end();

  return tokens;
}

function jsonEntryToToken(key: string, value: JSONValue, isBold?: boolean) {
  const tokenString = jsonToTokenizedString(value, key);
  return stringToToken(tokenString, `${key}:${value}`, isBold);
}

function jsonToTokenizedString(value: JSONValue | JSONValue[], key?: string): string {
  let result = '';
  if (key) {
    result = `"${key}": `;
  }

  // Case 1: Value is null
  if (!value) {
    result += 'null';
    return result;
  }

  // Case 2: Value is a string
  if (typeof value === 'string') {
    result += `"${value}"`;
    return result;
  }

  // Case 3: Value is one of the other primitive types
  if (typeof value === 'number' || typeof value === 'boolean') {
    result += `${value}`;
    return result;
  }

  // Case 4: Value is an array
  if (Array.isArray(value)) {
    result += '[';

    value.forEach((item, index) => {
      if (index === value.length - 1) {
        result += jsonToTokenizedString(item);
      } else {
        result += `${jsonToTokenizedString(item)}, `;
      }
    });

    result += ']';

    return result;
  }

  // Case 5: Value is an object
  if (typeof value === 'object') {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      result += '{}';
      return result;
    }

    result += '{ ';

    entries.forEach(([_key, val], index) => {
      if (index === entries.length - 1) {
        result += jsonToTokenizedString(val, _key);
      } else {
        result += `${jsonToTokenizedString(val, _key)}, `;
      }
    });

    result += ' }';
    return result;
  }

  // This branch should never be reached
  return '';
}

function stringToToken(str: string, keyProp: string, isBold?: boolean): ReactElement {
  return isBold ? <b key={keyProp}>{str}</b> : <span key={keyProp}>{str}</span>;
}
