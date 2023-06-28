import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateFilters} from 'sentry/views/starfish/utils/getDateFilters';

export const MAXIMUM_DATE_RANGE = 7;

function StarfishPageFilterContainer(props: {children: React.ReactNode}) {
  const {selection} = usePageFilters();
  const datetime = selection.datetime;

  const {endTime, startTime} = getDateFilters(selection);
  if (endTime.diff(startTime, 'days') > MAXIMUM_DATE_RANGE) {
    datetime.period = '24h';
    datetime.start = null;
    datetime.end = null;
  }

  return <PageFiltersContainer>{props.children}</PageFiltersContainer>;
}

export default StarfishPageFilterContainer;
