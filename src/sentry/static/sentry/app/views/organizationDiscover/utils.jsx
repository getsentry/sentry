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
  console.log('result is', result);
  return result;
}

export function getQueryStringFromQuery(query) {
  console.log('Entered getQueryString');
  let str = '?';

  console.log(Object.entries(query));

  //TODO get rid of amp at the end
  for (let key in query) {
    str += key + '=' + encodeURIComponent(JSON.stringify(query[key])) + '&';
  }
  return str;
}
