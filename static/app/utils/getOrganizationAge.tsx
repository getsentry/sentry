import moment from 'moment';

import {Organization} from 'app/types';

export default function getOrganizationAge(organization: Organization) {
  const dateCreated = moment(organization.dateCreated).utc().startOf('day');
  return moment().utc().startOf('day').diff(dateCreated, 'days');
}
