import moment from 'moment';

import {Organization} from 'sentry/types';

export default function getOrganizationAge(organization: Organization): number {
  const dateCreated = moment(organization.dateCreated).utc().startOf('day');
  return moment().utc().startOf('day').diff(dateCreated, 'days');
}
