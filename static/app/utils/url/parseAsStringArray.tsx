import {createMultiParser} from 'nuqs';

/**
 * Like `parseAsNativeArrayOf(parseAsString)`, but drops blank values so a bare
 * `?project=` reads as `[]` (matching `decodeList`) instead of `['']`.
 * `eq` compares by value because `createMultiParser` defaults to `===`, which
 * would stop `clearOnDefault` from removing an emptied key.
 */
export const parseAsStringArray = createMultiParser<string[]>({
  parse: values => values.filter(Boolean),
  serialize: values => values.filter(Boolean),
  eq: (a, b) => a.length === b.length && a.every((value, index) => value === b[index]),
}).withDefault([]);
