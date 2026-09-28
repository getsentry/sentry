import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

export const hasPermissions = ({access}: Organization, scope: Scope) =>
  access?.includes(scope);

export function hasSpendVisibilityNotificationsFeature(organization: Organization) {
  return organization.features.includes('spend-visibility-notifications');
}
