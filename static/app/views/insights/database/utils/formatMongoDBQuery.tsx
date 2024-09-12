import type {ReactElement} from 'react';

/**
 * Takes in a MongoDB query JSON string and outputs it as HTML tokens.
 * Performs some processing to surface the DB operation and collection so they are the first key-value
 * pair in the query, and **bolds** the operation
 *
 * @param query The query as a JSON string
 * @param command The DB command, e.g. `find`. This is available as a tag on database spans
 */
export function formatMongoDBQuery(query: string, command: string) {
  const queryObject = JSON.parse(query);

  const tokens: ReactElement[] = [];

  insertToken(tokens, '{ ');

  // Start by finding the key-value pair that represents the operation on the collection
  // and insert it as the first token
  const commandKey = Object.keys(queryObject).find(
    key => key.toLowerCase() === command.toLowerCase()
  );

  // If the command was somehow not found in the query, return it as a raw string since no formatting can be applied
  if (!commandKey) {
    return query;
  }

  const collection = queryObject[commandKey];

  processAndInsertKeyValueTokens(tokens, commandKey, collection, true);

  // Create the remaining tokens by iterating over all keys and skipping the command key
  Object.keys(queryObject).forEach(key => {
    if (key.toLowerCase() !== command.toLowerCase()) {
      const value = queryObject[key];
      processAndInsertKeyValueTokens(tokens, key, value);
    }
  });

  // Pop the last token since it will be an extra comma
  tokens.pop();
  insertToken(tokens, ' }');

  return tokens;
}

type JSONValue = string | number | object | boolean | null;

function processAndInsertKeyValueTokens(
  tokens: ReactElement[],
  key: string,
  value: JSONValue | JSONValue[],
  // Use isBold only for non-object kv pairs
  isBold?: boolean
) {
  // Wrapper function for better readability
  const _insertToken = (token: string) => insertToken(tokens, token, isBold);
  // Case 1: Value is null
  if (!value) {
    _insertToken(`"${key}": null`);
    _insertToken(', ');
    return;
  }

  // Case 2: Value is a primitive type
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    _insertToken(`"${key}": "${value}"`);
    _insertToken(`, `);
    return;
  }

  // Case 3: Value is an array
  if (Array.isArray(value)) {
    _insertToken(`"${key}": [`);

    value.forEach(item => {
      if (!item) {
        _insertToken('null');
        _insertToken(', ');
      } else if (
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
      ) {
        _insertToken(`${item}`);
        _insertToken(', ');
      } else {
        // We must recurse if item is an object
        if (Object.keys(item).length === 0) {
          processAndInsertKeyValueTokens(tokens, key, '{}');
        } else {
          _insertToken('{ ');
          Object.keys(item).forEach(_key => {
            processAndInsertKeyValueTokens(tokens, _key, item[_key]);
          });
          // Pop the trailing comma
          tokens.pop();

          _insertToken(' }');
          _insertToken(', ');
        }
      }
    });

    // Pop the trailing comma
    tokens.pop();
    _insertToken(' ]');
    _insertToken(', ');
    return;
  }

  // Case 4: Value is an object
  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      processAndInsertKeyValueTokens(tokens, key, '{}');
    } else {
      _insertToken(`"${key}": { `);
      Object.keys(value).forEach(_key => {
        processAndInsertKeyValueTokens(tokens, _key, value[_key]);
      });
      // Pop the trailing comma
      tokens.pop();

      _insertToken(' }');
      _insertToken(', ');
    }
  }

  return;
}

function insertToken(tokens: ReactElement[], token: string, isBold?: boolean) {
  isBold
    ? tokens.push(<b key={`${token}-${tokens.length}`}>{token}</b>)
    : tokens.push(<span key={`${token}-${tokens.length}`}>{token}</span>);
}
