import type {Organization} from 'sentry/types/organization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

/**
 * Ensure we refresh subscription when monitors are created
 */
export function handleMonitorCreated(organization: Organization) {
  SubscriptionStore.loadData(organization.slug);
}
