import React from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';
import {
  TrendChangeType,
  TrendsData,
  TrendsDataEvents,
  TrendsQuery,
  TrendView,
} from 'app/views/performance/trends/types';
import {
  generateTrendFunctionAsString,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
} from 'app/views/performance/trends/utils';

export type TrendsRequest = {
  trendChangeType?: TrendChangeType;
  eventView: Partial<TrendView>;
};

type RequestProps = DiscoverQueryProps & TrendsRequest;

type ChildrenProps = Omit<GenericChildrenProps<TrendsData>, 'tableData'> & {
  trendsData: TrendsData | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

type EventChildrenProps = Omit<GenericChildrenProps<TrendsDataEvents>, 'tableData'> & {
  trendsData: TrendsDataEvents | null;
};

type EventProps = RequestProps & {
  children: (props: EventChildrenProps) => React.ReactNode;
};

export function getTrendsRequestPayload(props: RequestProps) {
  const {eventView} = props;
  const apiPayload: TrendsQuery = eventView?.getEventsAPIPayload(props.location);
  const trendFunction = getCurrentTrendFunction(props.location);
  const trendParameter = getCurrentTrendParameter(props.location);
  apiPayload.trendFunction = generateTrendFunctionAsString(
    trendFunction.field,
    trendParameter.column
  );
  apiPayload.trendType = eventView?.trendType;
  apiPayload.interval = eventView?.interval;
  apiPayload.middle = eventView?.middle;
  return apiPayload;
}

function TrendsDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<TrendsData, TrendsRequest>
      route="events-trends-stats"
      getRequestPayload={getTrendsRequestPayload}
      {...props}
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
      route="events-trends"
      getRequestPayload={getTrendsRequestPayload}
      {...props}
    >
      {({tableData, ...rest}) => {
        return props.children({trendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export const TrendsEventsDiscoverQuery = withApi(EventsDiscoverQuery);

export default withApi(TrendsDiscoverQuery);
