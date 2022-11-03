export function extraQueryParameter(): URLSearchParams {
  const extraQueryString = window.SandboxData?.extraQueryString || '';
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

export function extraQueryParameterWithEmailV2(): URLSearchParams {
  const params = extraQueryParameter();
  const email = localStorage.getItem('email');
  if (email) {
    params.append('email', email);
  }
  params.append('referrer', 'sandbox-walkthrough');
  return params;
}

export function urlAttachQueryParams(url: string, params: URLSearchParams): string {
  const queryString = params.toString();
  if (queryString) {
    return url + '?' + queryString;
  }
  return url;
}

// For the Sandbox, we are testing a new walkthrough. This effects a few different components of Sentry including the Onboarding Sidebar, Onboarding Tasks, the Demo End Modal, Demo Sign Up Modal, Guides, and more.
// Outside of the Sandbox, this should have no effect on other elements of Sentry.
export function isDemoWalkthrough(): boolean {
  return localStorage.getItem('new-walkthrough') === '1';
}
