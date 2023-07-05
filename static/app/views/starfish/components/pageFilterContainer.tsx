import {useEffect} from 'react';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {getPageFilterStorage} from 'sentry/components/organizations/pageFilters/persistence';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {getDateFilters} from 'sentry/views/starfish/utils/getDateFilters';

import {
  getStarfishDateFilterStorage,
  setStarfishDateFilterStorage,
} from '../utils/dateFilterStorage';

export const MAXIMUM_DATE_RANGE = 7;
export const DEFAULT_STATS_PERIOD = '24h';

function limitDateRange(datetime, maximum = MAXIMUM_DATE_RANGE) {
  const {endTime, startTime} = getDateFilters(datetime);

  return endTime.diff(startTime, 'days') > maximum
    ? {period: DEFAULT_STATS_PERIOD, start: null, end: null}
    : {
        period: datetime.period,
        start: datetime.start ? getUtcDateString(datetime.start) : null,
        end: datetime.end ? getUtcDateString(datetime.end) : null,
        utc: datetime.utc,
      };
}

function StarfishPageFilterContainer(props: {children: React.ReactNode}) {
  const router = useRouter();
  const organization = useOrganization();
  const location = useLocation();

  useEffect(() => {
    const globalDatetimeStorage = getPageFilterStorage(organization.slug)?.state ?? {};
    const starfishDatetimeStorage = getStarfishDateFilterStorage(organization.slug);
    let datetime;

    // If user opened a shared link, use the filter values encoded in the link
    if (location.query.statsPeriod || (location.query.start && location.query.end)) {
      datetime = limitDateRange({
        start: location.query.start,
        end: location.query.end,
        period: location.query.statsPeriod,
        utc: location.query.utc,
      });
      // Else, use stored Starfish-specific values if available
    } else if (starfishDatetimeStorage) {
      datetime = limitDateRange(starfishDatetimeStorage);
      // Else, fall back to saved _global_ values
    } else {
      datetime = limitDateRange(globalDatetimeStorage);
      setStarfishDateFilterStorage(organization.slug, datetime);
    }

    router.replace({
      ...location,
      query: {
        ...location.query,
        statsPeriod: datetime.period,
        start: datetime.start ? datetime.start : undefined,
        end: datetime.end ? datetime.end : undefined,
        utc: datetime.utc,
      },
    });
    // On run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageFiltersContainer disablePersistence skipInitializeUrlParams>
      {props.children}
    </PageFiltersContainer>
  );
}

export default StarfishPageFilterContainer;
