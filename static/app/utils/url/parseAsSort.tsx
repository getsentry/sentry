import {createParser} from 'nuqs';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts, encodeSort} from 'sentry/utils/queryString';

export const parseAsSort = createParser({
  parse: value => decodeSorts(value).at(0) ?? null,
  serialize: (value: Sort) => encodeSort(value),
});
