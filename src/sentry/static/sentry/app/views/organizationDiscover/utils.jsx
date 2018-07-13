export function getQueryFromQueryString(queryString) {
  if (!queryString) {
    return {};
  }
  let parsedQuery = queryString;
  let result = {};
  parsedQuery = parsedQuery.replace(/^\?/, '').split('&');
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
  let str = '?';

  let keys = Object.keys(query);
  keys.sort();
  for (let i = 0; i < keys.length; ++i) {
    str += keys[i] + '=' + encodeURIComponent(JSON.stringify(query[keys[i]])) + '&';
  }

  return str;
}
