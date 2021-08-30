import getCookie from 'app/utils/getCookie';

// return email query parameter
export function emailQueryParameter(): string {
  const email = localStorage.getItem('email');
  const queryParameter = email ? `?email=${email}` : '';
  return queryParameter;
}

// return extra query depending, depending on if used in getStartedUrl
export function extraQueryParameter(getStarted: boolean): string {
  const email = localStorage.getItem('email');
  const extraQueryString = getCookie('extra_query_string');
  // cookies that have = sign are quotes so extra quotes need to be removed
  const extraQuery = extraQueryString ? extraQueryString.replaceAll('"', '') : '';

  if (getStarted) {
    const emailSeparator = email ? '&' : '?';
    const getStartedSeparator = extraQueryString ? emailSeparator : '';
    return getStartedSeparator + extraQuery;
  }
  const extraSeparator = extraQueryString ? `?` : '';
  return extraSeparator + extraQuery;
}
