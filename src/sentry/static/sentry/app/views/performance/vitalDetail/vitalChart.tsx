import React from 'react';
import {browserHistory} from 'react-router';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {OrganizationSummary} from 'app/types';
import {Client} from 'app/api';
import {t} from 'app/locale';
import LineChart from 'app/components/charts/lineChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import EventsRequest from 'app/components/charts/eventsRequest';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import QuestionTooltip from 'app/components/questionTooltip';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import {tooltipFormatter, axisLabelFormatter} from 'app/utils/discover/charts';
import getDynamicText from 'app/utils/getDynamicText';
import {Panel} from 'app/components/panels';
import styled from 'app/styled';
import space from 'app/styles/space';
import MarkLine from 'app/components/charts/components/markLine';

import {getMaxOfSeries, vitalChartTitleMap, vitalNameFromLocation} from './utils';
import {HeaderTitleLegend} from '../styles';
import {WEB_VITAL_DETAILS} from '../transactionVitals/constants';
import {
  replaceSeriesName,
  replaceSmoothedSeriesName,
  transformEventStatsSmoothed,
} from '../trends/utils';

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
    api: Client;
    location: Location;
    organization: OrganizationSummary;
  };

class VitalChart extends React.Component<Props> {
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
      api,
      project,
      environment,
      location,
      organization,
      query,
      statsPeriod,
      router,
    } = this.props;

    const start = this.props.start
      ? getUtcToLocalDateObject(this.props.start)
      : undefined;

    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : undefined;
    const utc = decodeScalar(router.location.query.utc);

    const vitalName = vitalNameFromLocation(location);
    const chartTitle = vitalChartTitleMap[vitalName];

    const yAxis = [`p50(${vitalName})`, `p75(${vitalName})`];

    const legend = {
      right: 10,
      top: 0,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      selected: getSeriesSelection(location),
    };

    const datetimeSelection = {
      start: start || null,
      end: end || null,
      period: statsPeriod,
    };

    const vitalThreshold = WEB_VITAL_DETAILS[vitalName].failureThreshold;

    const markLines = [
      {
        seriesName: 'Threshold',
        type: 'line',
        data: [],
        markLine: MarkLine({
          silent: true,
          lineStyle: {
            color: theme.textColor,
            type: 'dashed',
            width: 1,
          },
          label: {
            show: true,
            position: 'insideEndBottom',
            formatter: 'Threshold',
          },
          data: [
            {
              yAxis: vitalThreshold,
            } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
          ],
        }),
      },
    ];

    const chartOptions = {
      grid: {
        left: '10px',
        right: '10px',
        top: '40px',
        bottom: '0px',
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: tooltipFormatter,
      },
      yAxis: {
        min: 0,
        max: vitalThreshold,
        axisLabel: {
          color: theme.chartLabel,
          // coerces the axis to be time based
          formatter: (value: number) => axisLabelFormatter(value, 'p75()'),
        },
      },
    };

    return (
      <ChartBody>
        <HeaderTitleLegend>
          {t(chartTitle || '')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(`The durations shown should fall under the vital threshold.`)}
          />
        </HeaderTitleLegend>
        <ChartZoom
          router={router}
          period={statsPeriod}
          projects={project}
          environments={environment}
        >
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={[...project]}
              environment={[...environment]}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, true)}
              showLoading={false}
              query={query}
              includePrevious={false}
              yAxis={yAxis}
            >
              {({results, errored, loading, reloading}) => {
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
                        seriesName: replaceSmoothedSeriesName(seriesName) || 'Current',
                        ...rest,
                        color: colors[i],
                        lineStyle: {
                          opacity: 1,
                          width: 3,
                        },
                      };
                    })
                  : [];

                // Create a list of series based on the order of the fields,
                const series = results
                  ? results.map(({seriesName, ...rest}, i: number) => ({
                      seriesName: replaceSeriesName(seriesName) || 'Current',
                      ...rest,
                      color: colors[i],
                      lineStyle: {
                        width: 1,
                        opacity: 0.75,
                      },
                    }))
                  : [];

                const seriesMax = getMaxOfSeries(series);
                const yAxisMax = Math.max(seriesMax, vitalThreshold);
                chartOptions.yAxis.max = yAxisMax * 1.1;

                // Stack the toolbox under the legend.
                // so all series names are clickable.
                zoomRenderProps.toolBox.z = -1;

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
                                ...series,
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
      </ChartBody>
    );
  }
}

const ChartBody = styled(Panel)`
  padding: ${space(3)} ${space(2)};
`;

export default withApi(ReactRouter.withRouter(VitalChart));
