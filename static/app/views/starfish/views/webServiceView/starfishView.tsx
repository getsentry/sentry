import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {EventsStats} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {RateUnits} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {SpanGroupBar} from 'sentry/views/starfish/views/webServiceView/spanGroupBar';
import {BaseStarfishViewProps} from 'sentry/views/starfish/views/webServiceView/starfishLanding';

import EndpointList from './endpointList';

export function StarfishView(props: BaseStarfishViewProps) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const [activeSpanGroup, setActiveSpanGroup] = useState<string | null>(null);
  const [transactionsList, setTransactionsList] = useState<string[]>([]);
  const [inactiveTransactions, setInactiveTransactions] = useState<string[]>([]);

  function useRenderCharts() {
    let query = new MutableSearch([
      'event.type:transaction',
      'has:http.method',
      'transaction.op:http.server',
    ]);
    let dataset = DiscoverDatasets.METRICS;
    let yAxis = ['tps()', 'http_error_count()', 'avg(transaction.duration)'];
    let titles = [DataTitles.throughput, DataTitles.errorCount, DataTitles.avg];
    if (activeSpanGroup) {
      query = new MutableSearch([
        'transaction.op:http.server',
        `span.module:${activeSpanGroup}`,
      ]);
      dataset = DiscoverDatasets.SPANS_METRICS;
      yAxis = ['sps()', 'http_error_count()', 'avg(span.self_time)'];
      titles = [
        getThroughputTitle(activeSpanGroup),
        activeSpanGroup === 'http' ? DataTitles.errorCount : '--',
        `Avg Duration of ${activeSpanGroup} ${
          activeSpanGroup === 'db' ? 'Queries' : 'Spans'
        }`,
      ];
    }
    const transactionsFilter = `"${transactionsList.join('","')}"`;
    const queryString = query.formatString() + ` transaction:[${transactionsFilter}]`;

    const {isLoading: loading, data: results} = useEventsStatsQuery({
      eventView: EventView.fromNewQueryWithPageFilters(
        {
          name: '',
          fields: ['transaction', yAxis[0]],
          yAxis,
          query: queryString,
          dataset,
          version: 2,
          topEvents: '5',
          interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
        },
        selection
      ),
      enabled: transactionsList.length > 0,
      excludeOther: true,
      referrer: 'api.starfish-web-service.homepage-charts',
      initialData: {},
    });
    const {isLoading: totalLoading, data: totalResults} = useEventsStatsQuery({
      eventView: EventView.fromNewQueryWithPageFilters(
        {
          name: '',
          fields: [],
          yAxis,
          query: query.formatString(),
          dataset,
          version: 2,
          interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
        },
        selection
      ),
      enabled: true,
      referrer: 'api.starfish-web-service.homepage-charts',
      initialData: {},
    });
    useSynchronizeCharts([!loading]);
    if (loading || totalLoading || !totalResults || !results) {
      return <ChartPlaceholder />;
    }
    const seriesByName: {[category: string]: Series[]} = {};
    yAxis.forEach(axis => {
      seriesByName[axis] = [];
    });
    if (!inactiveTransactions.includes('Overall')) {
      Object.keys(totalResults).forEach(key => {
        seriesByName[key].push({
          seriesName: 'Overall',
          color: CHART_PALETTE[transactionsList.length][5],
          data:
            totalResults[key]?.data.map(datum => {
              return {name: datum[0] * 1000, value: datum[1][0].count} as SeriesDataUnit;
            }) ?? [],
        });
      });
    }
    transactionsList.forEach((transaction, index) => {
      const seriesData: EventsStats = results?.[transaction];
      if (!inactiveTransactions.includes(transaction)) {
        yAxis.forEach(key => {
          seriesByName[key].push({
            seriesName: transaction,
            color: CHART_PALETTE[transactionsList.length][index],
            data:
              seriesData?.[key]?.data.map(datum => {
                return {
                  name: datum[0] * 1000,
                  value: datum[1][0].count,
                } as SeriesDataUnit;
              }) ?? [],
          });
        });
      }
    });

    return (
      <Fragment>
        <ChartsContainerItem>
          <MiniChartPanel title={titles[2]}>
            <Chart
              height={142}
              data={seriesByName[yAxis[2]]}
              loading={loading}
              grid={{
                left: '0',
                right: '0',
                top: '8px',
                bottom: '0',
              }}
              aggregateOutputFormat="duration"
              definedAxisTicks={2}
              isLineChart
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'duration'),
              }}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <MiniChartPanel title={titles[0]}>
            <Chart
              height={142}
              data={seriesByName[yAxis[0]]}
              loading={loading}
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
        </ChartsContainerItem>

        <ChartsContainerItem>
          <MiniChartPanel title={titles[1]}>
            <Chart
              height={142}
              data={seriesByName[yAxis[1]]}
              loading={loading}
              grid={{
                left: '0',
                right: '0',
                top: '8px',
                bottom: '0',
              }}
              definedAxisTicks={2}
              isLineChart
              chartColors={[CHART_PALETTE[5][3]]}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
      </Fragment>
    );
  }

  return (
    <div data-test-id="starfish-view">
      <SpanGroupBar onHover={setActiveSpanGroup} />
      <StyledRow>
        <ChartsContainer>
          <ChartsContainerItem2>{useRenderCharts()}</ChartsContainerItem2>
        </ChartsContainer>
      </StyledRow>

      <EndpointList
        {...props}
        transactionsList={transactionsList}
        setTransactionsList={setTransactionsList}
        setError={usePageError().setPageError}
        inactiveTransactions={inactiveTransactions}
        setInactiveTransactions={setInactiveTransactions}
      />
    </div>
  );
}

const StyledRow = styled('div')`
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
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
`;

const ChartPlaceholder = styled('div')`
  height: 150px;
`;
