import queryString from 'query-string';
import parseurl from 'parseurl';
// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
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
  addQueryParamsToExistingUrl,
};
