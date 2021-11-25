import SdkUpdatesActions from 'sentry/actions/sdkUpdatesActions';
import {Client} from 'sentry/api';

/**
 * Load SDK Updates for a specific organization
 */
export async function loadSdkUpdates(api: Client, orgSlug: string) {
  const updates = await api.requestPromise(`/organizations/${orgSlug}/sdk-updates/`);
  SdkUpdatesActions.load(orgSlug, updates);
}
