import {Client} from 'sentry/api';
import SdkUpdatesStore from 'sentry/stores/sdkUpdatesStore';

/**
 * Load SDK Updates for a specific organization
 */
export async function loadSdkUpdates(api: Client, orgSlug: string) {
  const updates = await api.requestPromise(`/organizations/${orgSlug}/sdk-updates/`);
  SdkUpdatesStore.loadSuccess(orgSlug, updates);
}
