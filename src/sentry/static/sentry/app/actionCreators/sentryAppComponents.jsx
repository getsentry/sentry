import SentryAppComponentsActions from 'app/actions/sentryAppComponentActions';

export function fetchSentryAppComponents(api, orgSlug, projectId) {
  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;

  return api.requestPromise(componentsUri).then(res => {
    SentryAppComponentsActions.loadComponents(res);
    return res;
  });
}
