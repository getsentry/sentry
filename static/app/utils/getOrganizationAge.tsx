import type {Organization} from 'sentry/types/organization';

import getDaysSinceDate from './getDaysSinceDate';

export function getOrganizationAge(organization: Organization) {
  return getDaysSinceDate(organization.dateCreated);
}
