import {useQuery} from '@tanstack/react-query';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {useStarfishOptions} from 'sentry/views/starfish/utils/useStarfishOptions';

// Setting return type since I'd rather not know if its discover query or not
type ReturnType = {data: any; isLoading: boolean};

export function useSpansQuery({
  eventView,
  queryString,
  initialData,
}: {
  eventView?: EventView;
  initialData?: any;
  queryString?: string;
}): ReturnType {
  const {options} = useStarfishOptions();
  const {useDiscover} = options;
  const queryFunction = getQueryFunction({useDiscover});
  if (isDiscoverFunction(queryFunction)) {
    if (eventView) {
      return queryFunction(eventView, initialData);
    }
    throw new Error(
      'eventView argument must be defined when Starfish useDiscover is true'
    );
  }

  if (queryString) {
    return queryFunction(queryString, initialData);
  }
  throw new Error(
    'queryString argument must be defined when Starfish useDiscover is false, ie when using scraped data via fetch API'
  );
}

function isDiscoverFunction(
  queryFunction: Function
): queryFunction is typeof useWrappedDiscoverQuery {
  return queryFunction === useWrappedDiscoverQuery;
}

function useWrappedQuery(queryString: string, initialData?: any) {
  const {isLoading, data} = useQuery({
    queryKey: [queryString],
    queryFn: () => fetch(`${HOST}/?query=${queryString}`).then(res => res.json()),
    retry: false,
    initialData,
  });
  return {isLoading, data};
}

function useWrappedDiscoverQuery(eventView: EventView, initialData?: any) {
  const location = useLocation();
  const organization = useOrganization();
  const {isLoading, data} = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
  });
  return {isLoading, data: isLoading && initialData ? initialData : data?.data};
}

function getQueryFunction({useDiscover}: {useDiscover: boolean}) {
  if (useDiscover) {
    return useWrappedDiscoverQuery;
  }
  return useWrappedQuery;
}
