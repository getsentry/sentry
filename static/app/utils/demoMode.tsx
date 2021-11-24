import getCookie from 'sentry/utils/getCookie';

export function extraQueryParameter(): URLSearchParams {
  // cookies that have = sign are quotes so extra quotes need to be removed
  const extraQueryString = getCookie('extra_query_string')?.replaceAll('"', '') || '';
  const extraQuery = new URLSearchParams(extraQueryString);
  return extraQuery;
}

export function extraQueryParameterWithEmail(): URLSearchParams {
  const params = extraQueryParameter();
  const email = localStorage.getItem('email');
  if (email) {
    params.append('email', email);
  }
  return params;
}

export function urlAttachQueryParams(url: string, params: URLSearchParams): string {
  const queryString = params.toString();
  if (queryString) {
    return url + '?' + queryString;
  }
  return url;
}
