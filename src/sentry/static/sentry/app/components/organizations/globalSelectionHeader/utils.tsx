import {Location} from 'history';
import identity from 'lodash/identity';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import {GlobalSelection} from 'app/types';
import {DATE_TIME_KEYS, URL_PARAM} from 'app/constants/globalSelectionHeader';
import {defined} from 'app/utils';
import {getUtcToLocalDateObject} from 'app/utils/dates';

import {getParams} from './getParams';

const DEFAULT_PARAMS = getParams({});

// Parses URL query parameters for values relevant to global selection header
type GetStateFromQueryOptions = {
  allowEmptyPeriod?: boolean;
  allowAbsoluteDatetime?: boolean;
};
export function getStateFromQuery(
  query: Location['query'],
  {allowEmptyPeriod = false, allowAbsoluteDatetime = true}: GetStateFromQueryOptions = {}
) {
  const parsedParams = getParams(query, {allowEmptyPeriod, allowAbsoluteDatetime});

  const projectFromQuery = query[URL_PARAM.PROJECT];
  const environmentFromQuery = query[URL_PARAM.ENVIRONMENT];
  const period = parsedParams.statsPeriod;
  const utc = parsedParams.utc;

  const hasAbsolute = allowAbsoluteDatetime && !!parsedParams.start && !!parsedParams.end;

  let project: number[] | null | undefined;
  if (defined(projectFromQuery) && Array.isArray(projectFromQuery)) {
    project = projectFromQuery.map(p => parseInt(p, 10));
  } else if (defined(projectFromQuery)) {
    const projectFromQueryIdInt = parseInt(projectFromQuery, 10);
    project = isNaN(projectFromQueryIdInt) ? [] : [projectFromQueryIdInt];
  } else {
    project = projectFromQuery;
  }

  const environment =
    defined(environmentFromQuery) && !Array.isArray(environmentFromQuery)
      ? [environmentFromQuery]
      : environmentFromQuery;

  const start = hasAbsolute ? getUtcToLocalDateObject(parsedParams.start) : null;
  const end = hasAbsolute ? getUtcToLocalDateObject(parsedParams.end) : null;

  return {
    project,
    environment,
    period: period || null,
    start: start || null,
    end: end || null,
    // params from URL will be a string
    utc: typeof utc !== 'undefined' ? utc === 'true' : null,
  };
}

/**
 * Extract the global selection parameters from an object
 * Useful for extracting global selection properties from the current URL
 * when building another URL.
 */
export function extractSelectionParameters(query) {
  return pickBy(pick(query, Object.values(URL_PARAM)), identity);
}

/**
 * Extract the global selection datetime parameters from an object.
 */
export function extractDatetimeSelectionParameters(query) {
  return pickBy(pick(query, Object.values(DATE_TIME_KEYS)), identity);
}
export function getDefaultSelection(): GlobalSelection {
  const utc = DEFAULT_PARAMS.utc;
  return {
    projects: [],
    environments: [],
    datetime: {
      start: DEFAULT_PARAMS.start || null,
      end: DEFAULT_PARAMS.end || null,
      period: DEFAULT_PARAMS.statsPeriod || '',
      utc: typeof utc !== 'undefined' ? utc === 'true' : null,
    },
  };
}
