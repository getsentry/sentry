import pickBy from 'lodash/pickBy';
import qs from 'query-string';

import {getUtcDateString} from 'app/utils/dates';

import {getDiscoverConditionsToSearchString} from './getDiscoverConditionsToSearchString';

export function getEventsUrlPathFromDiscoverQuery({organization, selection, query}) {
  const {
    projects,
    datetime,
    environments, // eslint-disable-line no-unused-vars
    ...restSelection
  } = selection;

  return `/organizations/${organization.slug}/events/?${qs.stringify(
    pickBy({
      ...restSelection,
      project: projects,
      start: datetime.start && getUtcDateString(datetime.start),
      end: datetime.end && getUtcDateString(datetime.end),
      statsPeriod: datetime.period,
      query: getDiscoverConditionsToSearchString(query.conditions),
    })
  )}`;
}
