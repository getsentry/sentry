import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import Chart from 'sentry/views/starfish/components/chart';
import FailureRateChart from 'sentry/views/starfish/components/failureRateChart';

import EndpointList from './endpointList';

const EventsRequest = withApi(_EventsRequest);

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
};

export function StarfishView(props: BasePerformanceViewProps) {
  const {organization, eventView} = props;

  function renderModuleBreakdownChart() {
    return (
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
              chartColors={CHART_PALETTE[5]}
            />
          );
        }}
      </EventsRequest>
    );
  }

  function renderFailureRateChart() {
    const query = new MutableSearch(['event.type:transaction']);

    return (
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        interval="1h"
        includeTransformedData
        limit={1}
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-homepage-failure-rate"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis="equation|(count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500)))*100"
      >
        {data => {
          const transformedData: Series[] | undefined = data.timeseriesData?.map(
            series => ({
              data: series.data,
              seriesName: t('Failure Rate'),
              color: CHART_PALETTE[5][3],
            })
          );

          if (!transformedData) {
            return null;
          }

          return (
            <FailureRateChart
              statsPeriod={eventView.statsPeriod}
              height={180}
              data={transformedData}
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
              definedAxisTicks={4}
              chartColors={[CHART_PALETTE[5][4]]}
            />
          );
        }}
      </EventsRequest>
    );
  }

  return (
    <div data-test-id="starfish-view">
      <StyledRow minSize={200}>
        {/** TODO: The queries for these should eventually be batched */}
        {renderModuleBreakdownChart()}
        {renderFailureRateChart()}
      </StyledRow>

      <EndpointList
        {...props}
        setError={usePageError().setPageError}
        dataset="discover" // Metrics dataset can't do equations yet
        columnTitles={[
          'endpoint',
          'tpm',
          'p50(duration)',
          'p95(duration)',
          '% time spent',
        ]}
      />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
