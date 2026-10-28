import type {Project} from 'sentry/types/project';
import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {GenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {useProjects} from 'sentry/utils/useProjects';
import type {
  TrendChangeType,
  TrendFunctionField,
  TrendsDataEvents,
  TrendsQuery,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getTopTrendingEvents,
} from 'sentry/views/performance/trends/utils';
import {generateTrendFunctionAsString} from 'sentry/views/performance/trends/utils/generateTrendFunctionAsString';

type TrendsRequest = {
  eventView: Partial<TrendView>;
  projects: Project[];
  trendChangeType?: TrendChangeType;
  trendFunctionField?: TrendFunctionField;
};

type RequestProps = DiscoverQueryProps & TrendsRequest;

type EventChildrenProps = Omit<GenericChildrenProps<TrendsDataEvents>, 'tableData'> & {
  trendsData: TrendsDataEvents | null;
};

type EventProps = RequestProps & {
  children: (props: EventChildrenProps) => React.ReactNode;
};

function getTrendsRequestPayload(props: RequestProps) {
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
