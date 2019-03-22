import queryString from 'query-string';
import parseurl from 'parseurl';
// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
}

// returns environment name from query or null if not specified
// Any character can be valid in an environment name but we need to
// check for matching environments with the quotation marks first
// to match the way tag searches are being done
export function getQueryEnvironment(qs) {
  // A match with quotes will lazily match any characters within quotation marks
  const matchWithQuotes = qs.match(/(?:^|\s)environment:"(.*?)"/);
  // A match without quotes will match any non space character
  const matchWithoutQuotes = qs.match(/(?:^|\s)environment:([^\s]*)/);

  if (matchWithQuotes) {
    return matchWithQuotes[1];
  } else if (matchWithoutQuotes) {
    return matchWithoutQuotes[1];
  } else {
    return null;
  }
}

export function getQueryStringWithEnvironment(qs, env) {
  const qsWithoutEnv = qs.replace(/(?:^|\s)environment:[^\s]*/g, '');
  return formatQueryString(
    env === null ? qsWithoutEnv : `${qsWithoutEnv} environment:${env}`
  );
}

export function getQueryStringWithoutEnvironment(qs) {
  return formatQueryString(qs.replace(/(?:^|\s)environment:[^\s]*/g, ''));
}

export function addQueryParamsToExistingUrl(origUrl, queryParams) {
  const url = parseurl({url: origUrl});
  if (!url) {
    return '';
  }
  // Order the query params alphabetically.
  // Otherwise ``queryString`` orders them randomly and it's impossible to test.
  const params = JSON.parse(JSON.stringify(queryParams));
  const query = url.query ? {...queryString.parse(url.query), ...params} : params;

  return `${url.protocol}//${url.host}${url.pathname}?${queryString.stringify(query)}`;
}

export default {
  formatQueryString,
  getQueryEnvironment,
  getQueryStringWithEnvironment,
  getQueryStringWithoutEnvironment,
  addQueryParamsToExistingUrl,
};
