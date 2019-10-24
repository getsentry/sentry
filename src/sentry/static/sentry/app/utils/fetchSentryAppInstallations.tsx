import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';
import {Client} from 'app/api';
import {SentryAppInstallation} from 'app/types';

const fetchSentryAppInstallations = async (api: Client, orgSlug: string) => {
  const installsUri = `/organizations/${orgSlug}/sentry-app-installations/`;

  const installs: SentryAppInstallation[] = await api.requestPromise(installsUri);
  SentryAppInstallationStore.load(installs);
};

export default fetchSentryAppInstallations;
