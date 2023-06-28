import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters} from 'sentry/types';
import {getDateFilters} from 'sentry/views/starfish/utils/getDateFilters';

export const getDateConditions = (
  selection: PageFilters
): {end?: string | undefined; start?: string | undefined; statsPeriod?: string} => {
  const {startTime, endTime, statsPeriod} = getDateFilters(selection);
  const {start, end} = normalizeDateTimeParams({
    start: startTime.toDate(),
    end: endTime.toDate(),
  });
  return statsPeriod ? {statsPeriod} : {start, end};
};
