import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';

const EventsRequest = withApi(_EventsRequest);

import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {RateUnits} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import {AVG_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {SpanGroupBreakdownContainer} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';
import {BaseStarfishViewProps} from 'sentry/views/starfish/views/webServiceView/starfishLanding';

import EndpointList from './endpointList';

export function StarfishView(props: BaseStarfishViewProps) {
  const {organization, eventView} = props;
  const pageFilter = usePageFilters();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  function renderCharts() {
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
        interval={getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        )}
        includeTransformedData
        limit={1}
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="api.starfish-web-service.homepage-charts"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={['tps()', 'http_error_count()', 'avg(transaction.duration)']}
        dataset={DiscoverDatasets.METRICS}
      >
        {({loading, results}) => {
          if (!results || !results[0] || !results[1]) {
            return null;
          }

          const throughputData: Series = {
            seriesName: t('Requests'),
            data: results[0].data,
          };

          const errorsData: Series = {
            seriesName: t('5XX Responses'),
            color: CHART_PALETTE[5][3],
            data: results[1].data,
          };

          const percentileData: Series = {
            seriesName: t('Requests'),
            data: results[2].data,
          };

          setIsLoading(loading);

          return (
            <Fragment>
              <MiniChartPanel title={DataTitles.avg}>
                <Chart
                  height={71}
                  data={[percentileData]}
                  loading={loading}
                  utc={false}
                  grid={{
                    left: '0',
                    right: '0',
                    top: '8px',
                    bottom: '0',
                  }}
                  definedAxisTicks={2}
                  isLineChart
                  chartColors={[AVG_COLOR]}
                  tooltipFormatterOptions={{
                    valueFormatter: value =>
                      tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                  }}
                />
              </MiniChartPanel>
              <MiniChartPanel title={DataTitles.throughput}>
                <Chart
                  height={71}
                  data={[throughputData]}
                  loading={loading}
                  utc={false}
                  grid={{
                    left: '0',
                    right: '0',
                    top: '8px',
                    bottom: '0',
                  }}
                  aggregateOutputFormat="rate"
                  rateUnit={RateUnits.PER_SECOND}
                  definedAxisTicks={2}
                  stacked
                  isLineChart
                  chartColors={[THROUGHPUT_COLOR]}
                  tooltipFormatterOptions={{
                    valueFormatter: value => formatRate(value, RateUnits.PER_SECOND),
                  }}
                />
              </MiniChartPanel>

              <MiniChartPanel title={DataTitles.errorCount}>
                <Chart
                  height={71}
                  data={[errorsData]}
                  loading={loading}
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
                />
              </MiniChartPanel>
            </Fragment>
          );
        }}
      </EventsRequest>
    );
  }

  useSynchronizeCharts([isLoading]);

  return (
    <div data-test-id="starfish-view">
      <StyledRow minSize={300}>
        <ChartsContainer>
          <ChartsContainerItem>
            <SpanGroupBreakdownContainer />
          </ChartsContainerItem>
          <ChartsContainerItem2>{renderCharts()}</ChartsContainerItem2>
        </ChartsContainer>
      </StyledRow>

      <EndpointList {...props} setError={usePageError().setPageError} />
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
