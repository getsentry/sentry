import * as React from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import useProjects from 'sentry/utils/useProjects';
import withApi from 'sentry/utils/withApi';
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
} from 'sentry/views/performance/trends/utils';

export type TrendsRequest = {
  eventView: Partial<TrendView>;
  trendChangeType?: TrendChangeType;
  trendFunctionField?: TrendFunctionField;
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
  const {projects} = useProjects();
  const {eventView} = props;
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
  return apiPayload;
}

function TrendsDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<TrendsData, TrendsRequest>
      {...props}
      route="events-trends-stats"
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

export const TrendsEventsDiscoverQuery = withApi(EventsDiscoverQuery);

export default withApi(TrendsDiscoverQuery);
