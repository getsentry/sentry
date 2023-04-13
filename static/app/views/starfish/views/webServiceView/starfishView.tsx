import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import withApi from 'sentry/utils/withApi';
import Chart from 'sentry/views/starfish/components/chart';

import Table from '../../components/table';

const EventsRequest = withApi(_EventsRequest);
import {Fragment} from 'react';

import {Series} from 'sentry/types/echarts';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  withStaticFilters: boolean;
};

export function StarfishView(props: BasePerformanceViewProps) {
  const {organization, eventView} = props;

  return (
    <div data-test-id="starfish-view">
      <StyledRow minSize={200}>
        <EventsRequest
          query={eventView.query}
          includePrevious={false}
          partial
          interval="1h"
          includeTransformedData
          limit={1}
          environment={eventView.environment}
          project={eventView.project}
          period={eventView.statsPeriod}
          referrer="starfish-homepage-span-breakdown"
          start={eventView.start}
          end={eventView.end}
          organization={organization}
          yAxis={[
            'p95(spans.db)',
            'p95(spans.http)',
            'p95(spans.browser)',
            'p95(spans.resource)',
            'p95(spans.ui)',
          ]}
          queryExtras={{
            dataset: 'metrics',
          }}
        >
          {data => {
            return (
              <Fragment>
                <Chart
                  statsPeriod={eventView.statsPeriod}
                  height={180}
                  data={data.results as Series[]}
                  start={eventView.start as string}
                  end={eventView.end as string}
                  loading={data.loading}
                  utc={false}
                  grid={{
                    left: '0',
                    right: '0',
                    top: '16px',
                    bottom: '8px',
                  }}
                  disableMultiAxis
                  definedAxisTicks={4}
                  stacked
                  log
                  chartColors={[
                    '#444674',
                    '#7a5088',
                    '#b85586',
                    '#e9626e',
                    '#f58c46',
                    '#f2b712',
                  ]}
                />
              </Fragment>
            );
          }}
        </EventsRequest>
      </StyledRow>

      <Table {...props} setError={usePageError().setPageError} />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
