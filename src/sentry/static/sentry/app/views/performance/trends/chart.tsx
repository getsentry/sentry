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
import QuestionTooltip from 'app/components/questionTooltip';
import LineChart from 'app/components/charts/lineChart';
import {t} from 'app/locale';
import ChartZoom from 'app/components/charts/chartZoom';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';

import {trendToColor, getIntervalRatio} from './utils';
import {TrendChangeType, TrendsStats} from './types';
import {HeaderTitleLegend} from '../styles';

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
    transaction?: string;
    isLoading: boolean;
    statsData: TrendsStats;
  };

function getChartTitle(trendChangeType: TrendChangeType): string {
  switch (trendChangeType) {
    case TrendChangeType.IMPROVED:
      return t('Most Improved');
    case TrendChangeType.REGRESSION:
      return t('Worst Regressions');
    default:
      throw new Error('No trend type passed');
  }
}

function getChartTooltip(trendChangeType: TrendChangeType): string {
  return t('TODO: ' + trendChangeType);
}

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

function getIntervalLine(series: Series[], intervalRatio: number) {
  if (!series.length || !series[0].data || !series[0].data.length) {
    return [];
  }
  const additionalLineSeries = [
    {
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
      seriesName: 'Split',
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
    } = props;
    const chartTitle = getChartTitle(trendChangeType);
    const tooltip = getChartTooltip(trendChangeType);
    const lineColor = trendToColor[trendChangeType];

    const events = statsData && statsData[transaction || ''];
    const data = events ? events.data : [];

    const results = transformEventStats(data);

    const start = props.start ? getUtcToLocalDateObject(props.start) : undefined;

    const end = props.end ? getUtcToLocalDateObject(props.end) : undefined;
    const utc = decodeScalar(router.location.query.utc);

    const intervalRatio = getIntervalRatio(router.location);

    const loading = isLoading;
    const reloading = isLoading;

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {chartTitle}
          <QuestionTooltip size="sm" position="top" title={tooltip} />
        </HeaderTitleLegend>
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
                          tooltip={tooltip}
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
