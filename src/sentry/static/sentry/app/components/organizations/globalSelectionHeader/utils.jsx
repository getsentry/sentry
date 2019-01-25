import {defined} from 'app/utils';
import {pick, pickBy, identity} from 'lodash';
import {getLocalDateObject} from 'app/utils/dates';
import {URL_PARAM} from './constants';

// Parses URL query parameters for values relevant to global selection header
export function getStateFromQuery(query) {
  let start = query[URL_PARAM.START] !== 'null' && query[URL_PARAM.START];
  let end = query[URL_PARAM.END] !== 'null' && query[URL_PARAM.END];
  let project = query[URL_PARAM.PROJECT];
  let environment = query[URL_PARAM.ENVIRONMENT];
  let period = query[URL_PARAM.PERIOD];
  let utc = query[URL_PARAM.UTC];

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
    start = getLocalDateObject(start);
    end = getLocalDateObject(end);
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
