import {Project} from 'sentry/types';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withProjects from 'sentry/utils/withProjects';
import {
  TrendChangeType,
  TrendFunctionField,
  TrendsData,
  TrendsDataEvents,
  TrendsQuery,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {
  generateTrendFunctionAsString,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getTopTrendingEvents,
} from 'sentry/views/performance/trends/utils';

export type TrendsRequest = {
  eventView: Partial<TrendView>;
  projects: Project[];
  trendChangeType?: TrendChangeType;
  trendFunctionField?: TrendFunctionField;
  withBreakpoint?: boolean;
};

type RequestProps = DiscoverQueryProps & TrendsRequest;

export type TrendDiscoveryChildrenProps = Omit<
  GenericChildrenProps<TrendsData>,
  'tableData'
> & {
  trendsData: TrendsData | null;
};

type Props = RequestProps & {
  children: (props: TrendDiscoveryChildrenProps) => React.ReactNode;
};

type EventChildrenProps = Omit<GenericChildrenProps<TrendsDataEvents>, 'tableData'> & {
  trendsData: TrendsDataEvents | null;
};

type EventProps = RequestProps & {
  children: (props: EventChildrenProps) => React.ReactNode;
};

export function getTrendsRequestPayload(props: RequestProps) {
  const {eventView, projects} = props;
  const apiPayload: TrendsQuery = eventView?.getEventsAPIPayload(props.location);
  const trendFunction = getCurrentTrendFunction(props.location, props.trendFunctionField);
  const trendParameter = getCurrentTrendParameter(
    props.location,
    projects,
    eventView.project
  );
  apiPayload.trendFunction = generateTrendFunctionAsString(
    trendFunction.field,
    trendParameter.column
  );
  apiPayload.trendType = eventView?.trendType || props.trendChangeType;
  apiPayload.interval = eventView?.interval;
  apiPayload.middle = eventView?.middle;

  // This enables configuring the top event count for trend analysis
  // It's not necessary to set top event count unless
  // it's done for experimentation
  const topEventsCountAsString = getTopTrendingEvents(props.location);
  if (topEventsCountAsString) {
    apiPayload.topEvents = parseInt(topEventsCountAsString, 10);
  }

  return apiPayload;
}

function TrendsDiscoverQuery(props: Props) {
  const route = props.withBreakpoint ? 'events-trends-statsv2' : 'events-trends-stats';
  return (
    <GenericDiscoverQuery<TrendsData, TrendsRequest>
      {...props}
      route={route}
      getRequestPayload={getTrendsRequestPayload}
    >
      {({tableData, ...rest}) => {
        return props.children({trendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

function EventsDiscoverQuery(props: EventProps) {
  return (
    <GenericDiscoverQuery<TrendsDataEvents, TrendsRequest>
      {...props}
      route="events-trends"
      getRequestPayload={getTrendsRequestPayload}
    >
      {({tableData, ...rest}) => {
        return props.children({trendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export const TrendsEventsDiscoverQuery = withProjects(EventsDiscoverQuery);

export default withProjects(TrendsDiscoverQuery);
