import {Organization} from 'sentry/types';

import getDaysSinceDate from './getDaysSinceDate';

export default function getOrganizationAge(organization: Organization) {
  return getDaysSinceDate(organization.dateCreated);
}
