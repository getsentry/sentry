import React from 'react';

import withApi from 'app/utils/withApi';
import {
  ProjectTrendsDataEvents,
  TrendChangeType,
  TrendsData,
  TrendsQuery,
  TrendView,
} from 'app/views/performance/trends/types';
import {getCurrentTrendFunction} from 'app/views/performance/trends/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';

type TrendsRequest = {
  trendChangeType?: TrendChangeType;
  eventView: Partial<TrendView>;
};

type RequestProps = DiscoverQueryProps & TrendsRequest;

type ChildrenProps = Omit<GenericChildrenProps<TrendsData>, 'tableData'> & {
  projectTrendsData: ProjectTrendsDataEvents | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getTrendsRequestPayload(props: RequestProps) {
  const {eventView} = props;
  const apiPayload: TrendsQuery = eventView?.getEventsAPIPayload(props.location);
  const trendFunction = getCurrentTrendFunction(props.location);
  apiPayload.trendFunction = trendFunction.field;
  apiPayload.interval = eventView?.interval;
  return apiPayload;
}

function TrendsDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<ProjectTrendsDataEvents, TrendsRequest>
      route="events-trends"
      getRequestPayload={getTrendsRequestPayload}
      {...props}
    >
      {({tableData, ...rest}) => {
        return props.children({projectTrendsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(TrendsDiscoverQuery);
