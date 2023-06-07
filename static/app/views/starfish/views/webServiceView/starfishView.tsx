import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';

const EventsRequest = withApi(_EventsRequest);

import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {insertClickableAreasIntoSeries} from 'sentry/views/starfish/utils/insertClickableAreasIntoSeries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/webServiceView/endpointDetails';
import FailureDetailPanel from 'sentry/views/starfish/views/webServiceView/failureDetailPanel';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

import EndpointList from './endpointList';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
  organization: Organization;
  projects: Project[];
};

export function StarfishView(props: BasePerformanceViewProps) {
  const {organization, eventView, onSelect} = props;
  const theme = useTheme();
  const [selectedSpike, setSelectedSpike] = useState<FailureSpike>(null);

  const pageFilters = usePageFilters();
  const {selection} = pageFilters;
  const {projects, environments} = selection;

  useApiQuery<null>(
    [
      `/organizations/${organization.slug}/events-starfish/`,
      {
        query: {
          environment: environments,
          project: projects.map(proj => String(proj)),
          statsPeriod: '7d',
        },
      },
    ],
    {
      staleTime: 10,
    }
  );

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
        yAxis="equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))"
      >
        {eventData => {
          const transformedData: Series[] | undefined = eventData.timeseriesData?.map(
            series => ({
              data: series.data,
              seriesName: t('Error Rate'),
              color: CHART_PALETTE[5][3],
              silent: true,
            })
          );

          if (!transformedData) {
            return null;
          }

          insertClickableAreasIntoSeries(transformedData, theme.red300);

          return (
            <Fragment>
              <FailureDetailPanel
                onClose={() => setSelectedSpike(null)}
                chartData={transformedData}
                spike={selectedSpike}
              />
              <Chart
                statsPeriod={eventView.statsPeriod}
                height={80}
                data={transformedData}
                start={eventView.start as string}
                end={eventView.end as string}
                loading={eventData.loading}
                utc={false}
                grid={{
                  left: '0',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                definedAxisTicks={2}
                isLineChart
                chartColors={theme.charts.getColorPalette(2)}
                disableXAxis
                aggregateOutputFormat="percentage"
                onClick={e => {
                  if (e.componentType === 'markArea') {
                    setSelectedSpike({
                      startTimestamp: e.data.coord[0][0],
                      endTimestamp: e.data.coord[1][0],
                    });
                  }
                }}
              />
            </Fragment>
          );
        }}
      </EventsRequest>
    );
  }

  function renderThroughputChart() {
    const query = new MutableSearch([
      'event.type:transaction',
      'has:http.method',
      'transaction.op:http.server',
    ]);

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
        referrer="starfish-homepage-count"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis="tpm()"
        queryExtras={{dataset: 'metrics'}}
      >
        {({loading, timeseriesData}) => {
          const transformedData: Series[] | undefined = timeseriesData?.map(series => ({
            data: series.data,
            seriesName: t('Throughput'),
            color: CHART_PALETTE[0][0],
          }));

          if (!transformedData) {
            return null;
          }

          return (
            <Chart
              statsPeriod={eventView.statsPeriod}
              height={80}
              data={transformedData}
              start=""
              end=""
              loading={loading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '8px',
                bottom: '0',
              }}
              definedAxisTicks={2}
              stacked
              chartColors={theme.charts.getColorPalette(2)}
              disableXAxis
            />
          );
        }}
      </EventsRequest>
    );
  }

  function renderEndpointPercentileChart() {
    const query = new MutableSearch([
      'event.type:transaction',
      'has:http.method',
      'transaction.op:http.server',
    ]);

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
        referrer="starfish-homepage-count"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={['p95(transaction.duration)']}
        queryExtras={{dataset: 'metrics'}}
      >
        {({loading, results}) => {
          const transformedData: Series[] | undefined = results?.map(series => ({
            data: series.data,
            seriesName: series.seriesName,
          }));
          if (!transformedData) {
            return null;
          }

          return (
            <Chart
              statsPeriod={eventView.statsPeriod}
              height={107}
              data={transformedData}
              start=""
              end=""
              loading={loading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              definedAxisTicks={2}
              isLineChart
              chartColors={[P95_COLOR]}
              disableXAxis
              aggregateOutputFormat="duration"
            />
          );
        }}
      </EventsRequest>
    );
  }

  useSynchronizeCharts();

  return (
    <div data-test-id="starfish-view">
      <StyledRow minSize={200}>
        <ChartsContainer>
          <ChartsContainerItem>
            <SpanGroupBreakdownContainer />
          </ChartsContainerItem>
          <ChartsContainerItem2>
            <MiniChartPanel title={t('Error Rate')}>
              {renderFailureRateChart()}
            </MiniChartPanel>
            <MiniChartPanel title={DataTitles.p95}>
              {renderEndpointPercentileChart()}
            </MiniChartPanel>
            <MiniChartPanel title={t('Throughput')}>
              {renderThroughputChart()}
            </MiniChartPanel>
          </ChartsContainerItem2>
        </ChartsContainer>
      </StyledRow>

      <EndpointList
        {...props}
        setError={usePageError().setPageError}
        onSelect={onSelect}
      />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 2;
`;

const ChartsContainerItem2 = styled('div')`
  flex: 1;
`;
