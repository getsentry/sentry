import SentryAppComponentsActions from 'app/actions/sentryAppComponentActions';

export function fetchSentryAppComponents(api, orgSlug, projectId) {
  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;

  const promise = api.requestPromise(componentsUri);
  promise.then(res => SentryAppComponentsActions.loadComponents(res));
  return promise;
}
