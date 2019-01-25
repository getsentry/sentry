import qs from 'query-string';

import {getDiscoverConditionsToSearchString} from 'app/views/organizationDashboard/utils/getDiscoverConditionsToSearchString';

export function getEventsUrlPathFromDiscoverQuery({organization, selection, query}) {
  const {
    datetime,
    environments, // eslint-disable-line no-unused-vars
    ...restSelection
  } = selection;

  return `/organizations/${organization.slug}/events/?${qs.stringify({
    ...restSelection,
    start: datetime.start,
    end: datetime.end,
    statsPeriod: datetime.period,
    query: getDiscoverConditionsToSearchString(query.conditions),
  })}`;
}
