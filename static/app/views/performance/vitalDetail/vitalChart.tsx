import {Component} from 'react';
import {browserHistory} from 'react-router';
import * as ReactRouter from 'react-router';
import {withTheme} from '@emotion/react';
import {Location} from 'history';

import {Client} from 'app/api';
import ChartZoom from 'app/components/charts/chartZoom';
import MarkLine from 'app/components/charts/components/markLine';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {ChartContainer, HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {replaceSeriesName, transformEventStatsSmoothed} from '../trends/utils';

import {getMaxOfSeries, vitalNameFromLocation, webVitalMeh, webVitalPoor} from './utils';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = ReactRouter.WithRouterProps &
  ViewProps & {
    theme: Theme;
    api: Client;
    location: Location;
    organization: OrganizationSummary;
  };

class VitalChart extends Component<Props> {
  handleLegendSelectChanged = legendChange => {
    const {location} = this.props;
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  render() {
    const {
      theme,
      api,
      project,
      environment,
      location,
      organization,
      query,
      statsPeriod,
      router,
    } = this.props;

    const start = this.props.start ? getUtcToLocalDateObject(this.props.start) : null;
    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : null;
    const utc = decodeScalar(router.location.query.utc) !== 'false';

    const vitalName = vitalNameFromLocation(location);

    const yAxis = `p75(${vitalName})`;

    const legend = {
      right: 10,
      top: 0,
      selected: getSeriesSelection(location),
    };

    const datetimeSelection = {
      start,
      end,
      period: statsPeriod,
    };

    const vitalPoor = webVitalPoor[vitalName];
    const vitalMeh = webVitalMeh[vitalName];

    const markLines = [
      {
        seriesName: 'Thresholds',
        type: 'line',
        data: [],
        markLine: MarkLine({
          silent: true,
          lineStyle: {
            color: theme.red300,
            type: 'dashed',
            width: 1.5,
          },
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: t('Poor'),
          },
          data: [
            {
              yAxis: vitalPoor,
            } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
          ],
        }),
      },
      {
        seriesName: 'Thresholds',
        type: 'line',
        data: [],
        markLine: MarkLine({
          silent: true,
          lineStyle: {
            color: theme.yellow300,
            type: 'dashed',
            width: 1.5,
          },
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: t('Meh'),
          },
          data: [
            {
              yAxis: vitalMeh,
            } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
          ],
        }),
      },
    ];

    const chartOptions = {
      grid: {
        left: '5px',
        right: '10px',
        top: '35px',
        bottom: '0px',
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (value: number, seriesName?: string) =>
          tooltipFormatter(value, vitalName === WebVital.CLS ? seriesName : yAxis),
      },
      yAxis: {
        min: 0,
        max: vitalPoor,
        axisLabel: {
          color: theme.chartLabel,
          showMaxLabel: false,
          // coerces the axis to be time based
          formatter: (value: number) => axisLabelFormatter(value, yAxis),
        },
      },
    };

    return (
      <Panel>
        <ChartContainer>
          <HeaderTitleLegend>
            {t('Duration p75')}
            <QuestionTooltip
              size="sm"
              position="top"
              title={t(`The durations shown should fall under the vital threshold.`)}
            />
          </HeaderTitleLegend>
          <ChartZoom
            router={router}
            period={statsPeriod}
            start={start}
            end={end}
            utc={utc}
          >
            {zoomRenderProps => (
              <EventsRequest
                api={api}
                organization={organization}
                period={statsPeriod}
                project={project}
                environment={environment}
                start={start}
                end={end}
                interval={getInterval(datetimeSelection, 'high')}
                showLoading={false}
                query={query}
                includePrevious={false}
                yAxis={[yAxis]}
                partial
              >
                {({timeseriesData: results, errored, loading, reloading}) => {
                  if (errored) {
                    return (
                      <ErrorPanel>
                        <IconWarning color="gray500" size="lg" />
                      </ErrorPanel>
                    );
                  }

                  const colors =
                    (results && theme.charts.getColorPalette(results.length - 2)) || [];

                  const {smoothedResults} = transformEventStatsSmoothed(results);

                  const smoothedSeries = smoothedResults
                    ? smoothedResults.map(({seriesName, ...rest}, i: number) => {
                        return {
                          seriesName: replaceSeriesName(seriesName) || 'p75',
                          ...rest,
                          color: colors[i],
                          lineStyle: {
                            opacity: 1,
                            width: 2,
                          },
                        };
                      })
                    : [];

                  const seriesMax = getMaxOfSeries(smoothedSeries);
                  const yAxisMax = Math.max(seriesMax, vitalPoor);
                  chartOptions.yAxis.max = yAxisMax * 1.1;

                  return (
                    <ReleaseSeries
                      start={start}
                      end={end}
                      period={statsPeriod}
                      utc={utc}
                      projects={project}
                      environments={environment}
                    >
                      {({releaseSeries}) => (
                        <TransitionChart loading={loading} reloading={reloading}>
                          <TransparentLoadingMask visible={reloading} />
                          {getDynamicText({
                            value: (
                              <LineChart
                                {...zoomRenderProps}
                                {...chartOptions}
                                legend={legend}
                                onLegendSelectChanged={this.handleLegendSelectChanged}
                                series={[
                                  ...markLines,
                                  ...releaseSeries,
                                  ...smoothedSeries,
                                ]}
                              />
                            ),
                            fixed: 'Web Vitals Chart',
                          })}
                        </TransitionChart>
                      )}
                    </ReleaseSeries>
                  );
                }}
              </EventsRequest>
            )}
          </ChartZoom>
        </ChartContainer>
      </Panel>
    );
  }
}

export default withApi(withTheme(ReactRouter.withRouter(VitalChart)));
