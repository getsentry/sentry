import type {Project} from 'sentry/types/project';
import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import useProjects from 'sentry/utils/useProjects';
import type {
  TrendChangeType,
  TrendFunctionField,
  TrendsData,
  TrendsDataEvents,
  TrendsQuery,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getTopTrendingEvents,
} from 'sentry/views/performance/trends/utils';
import generateTrendFunctionAsString from 'sentry/views/performance/trends/utils/generateTrendFunctionAsString';

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

export default function TrendsDiscoverQuery(props: Omit<Props, 'projects'>) {
  const {projects} = useProjects();
  const route = props.withBreakpoint ? 'events-trends-statsv2' : 'events-trends-stats';
  return (
    <GenericDiscoverQuery<TrendsData, TrendsRequest>
      {...props}
      projects={projects}
      route={route}
      getRequestPayload={getTrendsRequestPayload}
    >
      {({tableData, ...rest}) => {
        return props.children({trendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export function TrendsEventsDiscoverQuery(props: Omit<EventProps, 'projects'>) {
  const {projects} = useProjects();
  return (
    <GenericDiscoverQuery<TrendsDataEvents, TrendsRequest>
      {...props}
      projects={projects}
      route="events-trends"
      getRequestPayload={getTrendsRequestPayload}
    >
      {({tableData, ...rest}) => {
        return props.children({trendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}
