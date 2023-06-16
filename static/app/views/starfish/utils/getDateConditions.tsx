import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {getDateFilters} from 'sentry/views/starfish/utils/getDateFilters';

export const getDateConditions = (
  pageFilter
): {end?: string | undefined; start?: string | undefined; statsPeriod?: string} => {
  const {startTime, endTime, statsPeriod} = getDateFilters(pageFilter);
  const {start, end} = normalizeDateTimeParams({
    start: startTime.toDate(),
    end: endTime.toDate(),
  });
  return statsPeriod ? {statsPeriod} : {start, end};
};
