import SentryAppComponentsActions from 'app/actions/sentryAppComponentActions';
import {Client} from 'app/api';
import {SentryAppComponent} from 'app/types';

export async function fetchSentryAppComponents(
  api: Client,
  orgSlug: string,
  projectId: string
): Promise<SentryAppComponent[]> {
  // Short-circuit if the API would just 404.
  if (!projectId) {
    return [];
  }

  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;

  const res = await api.requestPromise(componentsUri);
  SentryAppComponentsActions.loadComponents(res);
  return res;
}
