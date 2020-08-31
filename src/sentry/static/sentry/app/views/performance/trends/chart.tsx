import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';

import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import getDynamicText from 'app/utils/getDynamicText';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import EventView from 'app/utils/discover/eventView';
import {OrganizationSummary, EventsStatsData} from 'app/types';
import LineChart from 'app/components/charts/lineChart';
import ChartZoom from 'app/components/charts/chartZoom';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';

import {trendToColor, getIntervalRatio, getCurrentTrendFunction} from './utils';
import {TrendChangeType, TrendsStats, NormalizedTrendsTransaction} from './types';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    api: Client;
    location: Location;
    organization: OrganizationSummary;
    trendChangeType: TrendChangeType;
    transaction?: NormalizedTrendsTransaction;
    isLoading: boolean;
    statsData: TrendsStats;
  };

function transformEventStats(data: EventsStatsData, seriesName?: string): Series[] {
  return [
    {
      seriesName: seriesName || 'Current',
      data: data.map(([timestamp, countsForTimestamp]) => ({
        name: timestamp * 1000,
        value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
      })),
    },
  ];
}

function getLegend() {
  const legend = {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left',
    textStyle: {
      verticalAlign: 'top',
      fontSize: 11,
      fontFamily: 'Rubik',
    },
    data: [
      {
        name: 'Previous Period / This Period',
        icon:
          'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z',
      },
    ],
  };
  return legend;
}

function getIntervalLine(series: Series[], intervalRatio: number) {
  if (!series.length || !series[0].data || !series[0].data.length) {
    return [];
  }
  const additionalLineSeries = [
    {
      color: theme.gray700,
      data: [],
      markLine: {
        data: [] as any[],
        label: {show: false},
        lineStyle: {
          normal: {
            color: theme.gray700,
            type: 'dashed',
            width: 2,
          },
        },
        symbol: ['none', 'none'],
        tooltip: {
          show: false,
        },
      },
      seriesName: 'Previous Period / This Period',
    },
  ];
  const seriesStart = parseInt(series[0].data[0].name as string, 0);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name as string, 0);

  if (additionalLineSeries && seriesEnd > seriesStart) {
    const seriesDiff = seriesEnd - seriesStart;
    const seriesLine = seriesDiff * (intervalRatio || 0.5) + seriesStart;
    additionalLineSeries[0].markLine.data = [
      {
        value: 'Comparison line',
        xAxis: seriesLine,
      },
    ];
  }
  return additionalLineSeries;
}

class Chart extends React.Component<Props> {
  render() {
    const props = this.props;

    const {
      trendChangeType,
      router,
      statsPeriod,
      project,
      environment,
      transaction,
      statsData,
      isLoading,
      location,
    } = props;
    const lineColor = trendToColor[trendChangeType];

    const events =
      statsData && transaction?.project && transaction?.transaction
        ? statsData[[transaction.project, transaction.transaction].join(',')]
        : undefined;
    const data = events?.data ?? [];

    const trendFunction = getCurrentTrendFunction(location);
    const results = transformEventStats(data, trendFunction.label);

    const start = props.start ? getUtcToLocalDateObject(props.start) : undefined;

    const end = props.end ? getUtcToLocalDateObject(props.end) : undefined;
    const utc = decodeScalar(router.location.query.utc);

    const intervalRatio = getIntervalRatio(router.location);
    const legend = getLegend();

    const loading = isLoading;
    const reloading = isLoading;

    return (
      <React.Fragment>
        <ChartZoom
          router={router}
          period={statsPeriod}
          projects={project}
          environments={environment}
        >
          {zoomRenderProps => {
            const series = results
              ? results
                  .map(values => {
                    return {
                      ...values,
                      color: lineColor,
                      lineStyle: {
                        opacity: 1,
                      },
                    };
                  })
                  .reverse()
              : [];

            const intervalSeries = getIntervalLine(series, intervalRatio);

            return (
              <ReleaseSeries
                start={start}
                end={end}
                period={statsPeriod}
                utc={utc}
                projects={project}
              >
                {({releaseSeries}) => (
                  <TransitionChart loading={loading} reloading={reloading}>
                    <TransparentLoadingMask visible={reloading} />
                    {getDynamicText({
                      value: (
                        <LineChart
                          {...zoomRenderProps}
                          series={[...series, ...releaseSeries, ...intervalSeries]}
                          seriesOptions={{
                            showSymbol: false,
                          }}
                          legend={legend}
                          toolBox={{
                            show: false,
                          }}
                          grid={{
                            left: '10px',
                            right: '10px',
                            top: '40px',
                            bottom: '0px',
                          }}
                        />
                      ),
                      fixed: 'Duration Chart',
                    })}
                  </TransitionChart>
                )}
              </ReleaseSeries>
            );
          }}
        </ChartZoom>
      </React.Fragment>
    );
  }
}

export default withApi(withRouter(Chart));
