import React from 'react';
import styled from '@emotion/styled';

import Placeholder from 'app/components/placeholder';
import {Client} from 'app/api';
import {getInterval} from 'app/components/charts/utils';
import {Organization} from 'app/types';
import EventsRequest from 'app/components/charts/eventsRequest';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';

const Sparklines = React.lazy(() =>
  import(/* webpackChunkName: "Sparklines" */ 'app/components/sparklines')
);
const SparklinesLine = React.lazy(() =>
  import(/* webpackChunkName: "SparklinesLine" */ 'app/components/sparklines/line')
);

// Height of sparkline
const SPARKLINE_HEIGHT = 38;

type Props = {
  organization: Organization;
  api: Client;
  query: string;
  range: string;
  projects: number[];
  yAxis: string;
};

const Sparkline = ({organization, api, query, range, projects, yAxis}: Props) => (
  <EventsRequest
    organization={organization}
    api={api}
    query={query}
    start={undefined}
    end={undefined}
    period={range}
    interval={getInterval({period: range}, true)}
    project={projects}
    environment={[] as string[]}
    includePrevious={false}
    yAxis={yAxis}
  >
    {({loading, timeseriesData, errored}) => {
      if (loading || errored) {
        return null;
      }

      const data = (timeseriesData?.[0]?.data ?? []).map(d => d.value);

      return (
        <React.Suspense fallback={<SparkLinePlaceholder />}>
          <div data-test-id="incident-sparkline">
            <Sparklines data={data} width={100} height={32}>
              <SparklinesLine
                style={{
                  stroke: theme.gray500,
                  fill: 'none',
                  strokeWidth: 2,
                }}
              />
            </Sparklines>
          </div>
        </React.Suspense>
      );
    }}
  </EventsRequest>
);

export default withApi(Sparkline);

const SparkLinePlaceholder = styled(Placeholder)`
  height: ${SPARKLINE_HEIGHT}px;
`;
