import type {Organization} from 'sentry/types/organization';

import getDaysSinceDate from './getDaysSinceDate';

export default function getOrganizationAge(organization: Organization) {
  return getDaysSinceDate(organization.dateCreated);
}
