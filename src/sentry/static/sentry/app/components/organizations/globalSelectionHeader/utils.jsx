import {pick, pickBy, identity} from 'lodash';

import {defined} from 'app/utils';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';

// Parses URL query parameters for values relevant to global selection header
export function getStateFromQuery(query) {
  const parsedParams = getParams(query);

  let start = parsedParams.start;
  let end = parsedParams.end;
  let project = query[URL_PARAM.PROJECT];
  let environment = query[URL_PARAM.ENVIRONMENT];
  const period = parsedParams.statsPeriod;
  const utc = parsedParams.utc;

  const hasAbsolute = !!start && !!end;

  if (defined(project) && Array.isArray(project)) {
    project = project.map(p => parseInt(p, 10));
  } else if (defined(project)) {
    const projectIdInt = parseInt(project, 10);
    project = isNaN(projectIdInt) ? [] : [projectIdInt];
  }

  if (defined(environment) && !Array.isArray(environment)) {
    environment = [environment];
  }

  if (hasAbsolute) {
    start = getUtcToLocalDateObject(start);
    end = getUtcToLocalDateObject(end);
  }

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
