import {LocationDescriptorObject} from 'history';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {getDateFilters} from 'sentry/views/starfish/utils/getDateFilters';

export const MAXIMUM_DATE_RANGE = 7;
export const DEFAULT_STATS_PERIOD = '24h';

function StarfishPageFilterContainer(props: {children: React.ReactNode}) {
  const router = useRouter();
  const location = useLocation();
  const {selection} = usePageFilters();
  const datetime = selection.datetime;

  const {endTime, startTime} = getDateFilters(selection);
  const invalidDateFilters = endTime.diff(startTime, 'days') > MAXIMUM_DATE_RANGE;
  if (invalidDateFilters) {
    datetime.period = DEFAULT_STATS_PERIOD;
    datetime.start = null;
    datetime.end = null;
    const query: LocationDescriptorObject['query'] = {
      ...location.query,
      statsPeriod: DEFAULT_STATS_PERIOD,
    };
    delete query.start;
    delete query.end;

    router.replace({
      pathname: location.pathname,
      query,
    });
  }

  if (invalidDateFilters) {
    return null;
  }

  return <PageFiltersContainer>{props.children}</PageFiltersContainer>;
}

export default StarfishPageFilterContainer;
