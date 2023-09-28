import {getInterval} from 'sentry/components/charts/utils';
import {Series} from 'sentry/types/echarts';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  element: string;
  operation: string;
  page: string;
};

export const useInteractionBreakdownTimeseriesQuery = ({
  operation,
  element,
  page,
}: Props): {data: Series[]; isLoading: boolean} => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const search = new MutableSearch(
    `transaction.op:${operation} transaction:${page} interactionElement:${element}`
  );
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [`p75(transaction.duration)`],
      name: 'Interaction Duration',
      query: search.formatString(),
      version: 2,
      fields: [],
      interval: getInterval(pageFilters.selection.datetime, 'low'),
      dataset: DiscoverDatasets.DISCOVER,
    },
    pageFilters.selection
  );

  const result = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    eventView: projectTimeSeriesEventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...projectTimeSeriesEventView.getEventsAPIPayload(location),
      yAxis: projectTimeSeriesEventView.yAxis,
      topEvents: projectTimeSeriesEventView.topEvents,
      excludeOther: 0,
      partial: 1,
      orderby: undefined,
      interval: projectTimeSeriesEventView.interval,
    }),
    options: {
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });

  const seriesData: Series = {
    seriesName: 'p75(duration)',
    data: [],
  };

  const transformedData = result?.data?.data.map(data => ({
    name: data[0] as string,
    value: data[1][0].count,
  }));

  seriesData.data = transformedData ?? [];

  return {data: [seriesData], isLoading: result.isLoading};
};
