import {createParser} from 'nuqs';

import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

const parseAsSort = createParser({
  parse: value => decodeSorts(value).at(0) ?? null,
  serialize: (value: Sort) => encodeSort(value),
});

export default parseAsSort;
