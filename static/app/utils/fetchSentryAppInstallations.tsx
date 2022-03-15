import {Client} from 'sentry/api';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {SentryAppInstallation} from 'sentry/types';

async function fetchSentryAppInstallations(api: Client, orgSlug: string): Promise<void> {
  const installsUri = `/organizations/${orgSlug}/sentry-app-installations/`;

  const installs: SentryAppInstallation[] = await api.requestPromise(installsUri);
  SentryAppInstallationStore.load(installs);
}

export default fetchSentryAppInstallations;
