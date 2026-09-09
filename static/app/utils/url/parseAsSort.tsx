import {createMultiParser, createParser} from 'nuqs';

import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

export const parseAsSort = createParser({
  parse: value => decodeSorts(value).at(0) ?? null,
  serialize: (value: Sort) => encodeSort(value),
});

/**
 * Multi-value counterpart to `parseAsSort`, for the repeated `?sort=a&sort=b`
 * form that a few list views accept.
 */
export const parseAsSorts = createMultiParser({
  parse: (values: readonly string[]) => decodeSorts([...values]),
  serialize: (values: Sort[]) => values.map(encodeSort),
}).withDefault([] as Sort[]);
