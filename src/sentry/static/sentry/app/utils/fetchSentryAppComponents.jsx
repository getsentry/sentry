import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';

const fetchSentryAppComponents = (api, orgSlug, projectId) => {
  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;

  function updateComponentsStore(components) {
    SentryAppComponentsStore.load(components);
  }

  api.requestPromise(componentsUri).then(updateComponentsStore);
};

export default fetchSentryAppComponents;
