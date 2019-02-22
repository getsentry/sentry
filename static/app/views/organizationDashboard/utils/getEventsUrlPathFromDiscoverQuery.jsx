import {pickBy} from 'lodash';
import qs from 'query-string';

import {getDiscoverConditionsToSearchString} from 'app/views/organizationDashboard/utils/getDiscoverConditionsToSearchString';
import {getUtcDateString} from 'app/utils/dates';

export function getEventsUrlPathFromDiscoverQuery({organization, selection, query}) {
  const {
    datetime,
    environments, // eslint-disable-line no-unused-vars
    ...restSelection
  } = selection;

  return `/organizations/${organization.slug}/events/?${qs.stringify(
    pickBy({
      ...restSelection,
      start: datetime.start && getUtcDateString(datetime.start),
      end: datetime.end && getUtcDateString(datetime.end),
      statsPeriod: datetime.period,
      query: getDiscoverConditionsToSearchString(query.conditions),
    })
  )}`;
}
