export function getQueryFromQueryString(queryString) {
  if (!queryString) {
    return {};
  }
  let parsedQuery = queryString;
  let result = {};
  parsedQuery = parsedQuery.replace(/^\?|\/$/g, '').split('&');
  parsedQuery.forEach(item => {
    if (item.includes('=')) {
      let key = item.split('=')[0];
      let value = JSON.parse(decodeURIComponent(item.split('=')[1]));
      result[key] = value;
    }
  });

  return result;
}

export function getQueryStringFromQuery(query) {
  const queryProperties = Object.entries(query).map(([key, value]) => {
    return key + '=' + encodeURIComponent(JSON.stringify(value));
  });

  return `?${queryProperties.join('&')}`;
}
