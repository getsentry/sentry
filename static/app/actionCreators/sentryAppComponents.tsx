import SentryAppComponentsActions from 'sentry/actions/sentryAppComponentActions';
import {Client} from 'sentry/api';
import {SentryAppComponent} from 'sentry/types';

export async function fetchSentryAppComponents(
  api: Client,
  orgSlug: string,
  projectId: string
): Promise<SentryAppComponent[]> {
  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;

  const res = await api.requestPromise(componentsUri);
  SentryAppComponentsActions.loadComponents(res);
  return res;
}
