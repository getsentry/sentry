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

  tokens.push(<span>{'{ '}</span>);

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
  tokens.push(<span>{' }'}</span>);

  return tokens;
}

function processAndInsertKeyValueTokens(
  tokens: ReactElement[],
  key: string,
  value: string | number | object,
  // Use isBold only for non-object kv pairs
  isBold?: boolean
) {
  // Case 1: Value is a string
  if (typeof value === 'string') {
    tokens.push(<span>{`"`}</span>);
    isBold ? tokens.push(<b>{key}</b>) : tokens.push(<span>{key}</span>);
    tokens.push(<span>{`": `}</span>);

    isBold ? tokens.push(<b>{value}</b>) : tokens.push(<span>{value}</span>);
    tokens.push(<span>{', '}</span>);
  }

  // Case 2 (recursion case): Value is an object
  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      processAndInsertKeyValueTokens(tokens, key, '{}');
    } else {
      tokens.push(<span>{`"${key}": { `}</span>);
      Object.keys(value).forEach(_key => {
        processAndInsertKeyValueTokens(tokens, _key, value[_key]);
      });
      // Pop the trailing comma
      tokens.pop();

      tokens.push(<span>{' }'}</span>);
      tokens.push(<span>{', '}</span>);
    }
  }

  return tokens;
}
