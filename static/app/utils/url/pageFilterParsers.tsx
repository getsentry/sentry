import {parseAsString} from 'nuqs';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

export const pageFilterParsers = {
  end: parseAsString.withDefault(''),
  environment: parseAsStringArray,
  project: parseAsStringArray,
  start: parseAsString.withDefault(''),
  statsPeriod: parseAsString.withDefault(''),
  utc: parseAsString.withDefault(''),
};
