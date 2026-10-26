import {parseAsString} from 'nuqs';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

/**
 * The page filter params, for pages that read them with nuqs alongside their
 * own params instead of through `usePageFilters`.
 */
export const pageFilterParsers = {
  end: parseAsString.withDefault(''),
  environment: parseAsStringArray,
  project: parseAsStringArray,
  start: parseAsString.withDefault(''),
  statsPeriod: parseAsString.withDefault(''),
  utc: parseAsString.withDefault(''),
};
