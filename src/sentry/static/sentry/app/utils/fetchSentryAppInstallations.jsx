import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';
import SentryAppStore from 'app/stores/sentryAppStore';

const fetchSentryAppInstallations = (api, orgSlug) => {
  const sentryAppsUri = '/sentry-apps/';
  const ownedSentryAppsUri = `/organizations/${orgSlug}/sentry-apps/`;
  const installsUri = `/organizations/${orgSlug}/sentry-app-installations/`;

  function updateSentryAppStore(sentryApps) {
    SentryAppStore.load(sentryApps);
  }

  function fetchOwnedSentryApps() {
    api
      .requestPromise(ownedSentryAppsUri, {query: {status: 'published'}})
      .then(apps => SentryAppStore.add(...apps));
  }

  function fetchInstalls() {
    api
      .requestPromise(installsUri)
      .then(installs => installs.map(setSentryApp))
      .then(updateInstallStore);
  }

  function setSentryApp(install) {
    install.sentryApp = SentryAppStore.get(install.app.slug);
    return install;
  }

  function updateInstallStore(installs) {
    SentryAppInstallationStore.load(installs);
  }

  api
    .requestPromise(sentryAppsUri)
    .then(updateSentryAppStore)
    .then(fetchOwnedSentryApps)
    .then(fetchInstalls);
};

export default fetchSentryAppInstallations;
