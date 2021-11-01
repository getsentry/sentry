import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import color from 'color';
import capitalize from 'lodash/capitalize';
import moment from 'moment';
import momentTimezone from 'moment-timezone';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import ChartZoom from 'app/components/charts/chartZoom';
import Graphic from 'app/components/charts/components/graphic';
import MarkArea from 'app/components/charts/components/markArea';
import MarkLine from 'app/components/charts/components/markLine';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart, {LineChartSeries} from 'app/components/charts/lineChart';
import LineSeries from 'app/components/charts/series/lineSeries';
import SessionsRequest from 'app/components/charts/sessionsRequest';
import {SectionHeading} from 'app/components/charts/styles';
import {
  parseStatsPeriod,
  StatsPeriodType,
} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {AvatarProject, DateString, Organization, Project} from 'app/types';
import {ReactEchartsRef, Series} from 'app/types/echarts';
import {getUtcDateString} from 'app/utils/dates';
import getDynamicText from 'app/utils/getDynamicText';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'app/utils/sessions';
import theme from 'app/utils/theme';
import {alertDetailsLink} from 'app/views/alerts/details';
import {COMPARISON_DELTA_OPTIONS} from 'app/views/alerts/incidentRules/constants';
import {makeDefaultCta} from 'app/views/alerts/incidentRules/incidentRulePresets';
import {Dataset, IncidentRule} from 'app/views/alerts/incidentRules/types';
import {AlertWizardAlertNames} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';

import {Incident, IncidentActivityType, IncidentStatus} from '../../types';
import {
  ALERT_CHART_MIN_MAX_BUFFER,
  alertAxisFormatter,
  alertTooltipValueFormatter,
  isSessionAggregate,
  SESSION_AGGREGATE_TO_FIELD,
  shouldScaleAlertChart,
} from '../../utils';

import {TimePeriodType} from './constants';

const X_AXIS_BOUNDARY_GAP = 20;
const VERTICAL_PADDING = 22;

type Props = WithRouterProps & {
  api: Client;
  rule: IncidentRule;
  incidents?: Incident[];
  timePeriod: TimePeriodType;
  selectedIncident?: Incident | null;
  organization: Organization;
  projects: Project[] | AvatarProject[];
  interval: string;
  filter: React.ReactNode;
  query: string;
  orgId: string;
  handleZoom: (start: DateString, end: DateString) => void;
};

type State = {
  width: number;
  height: number;
};

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  const {
    options: {timezone},
  } = ConfigStore.get('user');
  return momentTimezone.tz(date, timezone).format(format);
}

function createThresholdSeries(lineColor: string, threshold: number): LineChartSeries {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold} as any],
      label: {
        show: false,
      },
    }),
    data: [],
  };
}

function createStatusAreaSeries(
  lineColor: string,
  startTime: number,
  endTime: number,
  yPosition: number
): LineChartSeries {
  return {
    seriesName: '',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'solid', width: 4},
      data: [[{coord: [startTime, yPosition]}, {coord: [endTime, yPosition]}] as any],
    }),
    data: [],
  };
}

function createIncidentSeries(
  router: Props['router'],
  organization: Organization,
  lineColor: string,
  incidentTimestamp: number,
  incident: Incident,
  dataPoint?: LineChartSeries['data'][0],
  seriesName?: string,
  aggregate?: string
) {
  const series = {
    seriesName: 'Incident Line',
    type: 'line',
    markLine: MarkLine({
      silent: false,
      lineStyle: {color: lineColor, type: 'solid'},
      data: [
        {
          xAxis: incidentTimestamp,
          onClick: () => {
            router.push({
              pathname: alertDetailsLink(organization, incident),
              query: {alert: incident.identifier},
            });
          },
        },
      ] as any,
      label: {
        show: incident.identifier,
        position: 'insideEndBottom',
        formatter: incident.identifier,
        color: lineColor,
        fontSize: 10,
        fontFamily: 'Rubik',
      } as any,
    }),
    data: [],
  };
  // tooltip conflicts with MarkLine types
  (series.markLine as any).tooltip = {
    trigger: 'item',
    alwaysShowContent: true,
    formatter: ({value, marker}) => {
      const time = formatTooltipDate(moment(value), 'MMM D, YYYY LT');
      return [
        `<div class="tooltip-series"><div>`,
        `<span class="tooltip-label">${marker} <strong>${t('Alert')} #${
          incident.identifier
        }</strong></span>${
          dataPoint?.value
            ? `${seriesName} ${alertTooltipValueFormatter(
                dataPoint.value,
                seriesName ?? '',
                aggregate ?? ''
              )}`
            : ''
        }`,
        `</div></div>`,
        `<div class="tooltip-date">${time}</div>`,
        `<div class="tooltip-arrow"></div>`,
      ].join('');
    },
  };

  return series;
}

class MetricChart extends React.PureComponent<Props, State> {
  state = {
    width: -1,
    height: -1,
  };

  ref: null | ReactEchartsRef = null;

  /**
   * Syncs component state with the chart's width/heights
   */
  updateDimensions = () => {
    const chartRef = this.ref?.getEchartsInstance?.();
    if (!chartRef) {
      return;
    }

    const width = chartRef.getWidth();
    const height = chartRef.getHeight();
    if (width !== this.state.width || height !== this.state.height) {
      this.setState({
        width,
        height,
      });
    }
  };

  handleRef = (ref: ReactEchartsRef): void => {
    if (ref && !this.ref) {
      this.ref = ref;
      this.updateDimensions();
    }

    if (!ref) {
      this.ref = null;
    }
  };

  getRuleChangeThresholdElements = (data: LineChartSeries[]): any[] => {
    const {height, width} = this.state;
    const {dateModified} = this.props.rule || {};

    if (!data.length || !data[0].data.length || !dateModified) {
      return [];
    }

    const seriesData = data[0].data;
    const seriesStart = moment(seriesData[0].name).valueOf();
    const seriesEnd = moment(seriesData[seriesData.length - 1].name).valueOf();
    const ruleChanged = moment(dateModified).valueOf();

    if (ruleChanged < seriesStart) {
      return [];
    }

    const chartWidth = width - X_AXIS_BOUNDARY_GAP;
    const position =
      X_AXIS_BOUNDARY_GAP +
      Math.round((chartWidth * (ruleChanged - seriesStart)) / (seriesEnd - seriesStart));

    return [
      {
        type: 'line',
        draggable: false,
        position: [position, 0],
        shape: {y1: 0, y2: height - VERTICAL_PADDING, x1: 1, x2: 1},
        style: {
          stroke: theme.gray200,
        },
      },
      {
        type: 'rect',
        draggable: false,
        position: [X_AXIS_BOUNDARY_GAP, 0],
        shape: {
          // +1 makes the gray area go midway onto the dashed line above
          width: position - X_AXIS_BOUNDARY_GAP + 1,
          height: height - VERTICAL_PADDING,
        },
        style: {
          fill: color(theme.gray100).alpha(0.42).rgb().string(),
        },
      },
    ];
  };

  renderChartActions(
    totalDuration: number,
    criticalDuration: number,
    warningDuration: number
  ) {
    const {rule, orgId, projects, timePeriod, query} = this.props;
    const ctaOpts = {
      orgSlug: orgId,
      projects: projects as Project[],
      rule,
      eventType: query,
      start: timePeriod.start,
      end: timePeriod.end,
    };

    const {buttonText, ...props} = makeDefaultCta(ctaOpts);

    const resolvedPercent =
      (100 * Math.max(totalDuration - criticalDuration - warningDuration, 0)) /
      totalDuration;
    const criticalPercent = 100 * Math.min(criticalDuration / totalDuration, 1);
    const warningPercent = 100 * Math.min(warningDuration / totalDuration, 1);

    return (
      <ChartActions>
        <ChartSummary>
          <SummaryText>{t('SUMMARY')}</SummaryText>
          <SummaryStats>
            <StatItem>
              <IconCheckmark color="green300" isCircled />
              <StatCount>{resolvedPercent ? resolvedPercent.toFixed(2) : 0}%</StatCount>
            </StatItem>
            <StatItem>
              <IconWarning color="yellow300" />
              <StatCount>{warningPercent ? warningPercent.toFixed(2) : 0}%</StatCount>
            </StatItem>
            <StatItem>
              <IconFire color="red300" />
              <StatCount>{criticalPercent ? criticalPercent.toFixed(2) : 0}%</StatCount>
            </StatItem>
          </SummaryStats>
        </ChartSummary>
        {!isSessionAggregate(rule.aggregate) && (
          <Feature features={['discover-basic']}>
            <Button size="small" {...props}>
              {buttonText}
            </Button>
          </Feature>
        )}
      </ChartActions>
    );
  }

  renderChart(
    loading: boolean,
    timeseriesData?: Series[],
    minutesThresholdToDisplaySeconds?: number,
    comparisonTimeseriesData?: Series[]
  ) {
    const {
      router,
      selectedIncident,
      interval,
      handleZoom,
      filter,
      query,
      incidents,
      rule,
      organization,
      timePeriod: {start, end},
    } = this.props;
    const {dateModified, timeWindow, aggregate} = rule;

    if (loading || !timeseriesData) {
      return this.renderEmpty();
    }

    const criticalTrigger = rule.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule.triggers.find(({label}) => label === 'warning');

    const series: LineChartSeries[] = [...timeseriesData];
    const areaSeries: any[] = [];
    // Ensure series data appears above incident lines
    series[0].z = 100;
    const dataArr = timeseriesData[0].data;
    const maxSeriesValue = dataArr.reduce(
      (currMax, coord) => Math.max(currMax, coord.value),
      0
    );
    // find the lowest value between chart data points, warning threshold,
    // critical threshold and then apply some breathing space
    const minChartValue = shouldScaleAlertChart(aggregate)
      ? Math.floor(
          Math.min(
            dataArr.reduce((currMax, coord) => Math.min(currMax, coord.value), Infinity),
            typeof warningTrigger?.alertThreshold === 'number'
              ? warningTrigger.alertThreshold
              : Infinity,
            typeof criticalTrigger?.alertThreshold === 'number'
              ? criticalTrigger.alertThreshold
              : Infinity
          ) / ALERT_CHART_MIN_MAX_BUFFER
        )
      : 0;
    const firstPoint = moment(dataArr[0]?.name).valueOf();
    const lastPoint = moment(dataArr[dataArr.length - 1]?.name).valueOf();
    const totalDuration = lastPoint - firstPoint;
    let criticalDuration = 0;
    let warningDuration = 0;

    series.push(
      createStatusAreaSeries(theme.green300, firstPoint, lastPoint, minChartValue)
    );

    if (incidents) {
      // select incidents that fall within the graph range
      const periodStart = moment.utc(firstPoint);

      incidents
        .filter(
          incident =>
            !incident.dateClosed || moment(incident.dateClosed).isAfter(periodStart)
        )
        .forEach(incident => {
          const statusChanges = incident.activities
            ?.filter(
              ({type, value}) =>
                type === IncidentActivityType.STATUS_CHANGE &&
                value &&
                [`${IncidentStatus.WARNING}`, `${IncidentStatus.CRITICAL}`].includes(
                  value
                )
            )
            .sort(
              (a, b) => moment(a.dateCreated).valueOf() - moment(b.dateCreated).valueOf()
            );

          const incidentEnd = incident.dateClosed ?? moment().valueOf();

          const timeWindowMs = rule.timeWindow * 60 * 1000;
          const incidentColor =
            warningTrigger &&
            statusChanges &&
            !statusChanges.find(({value}) => value === `${IncidentStatus.CRITICAL}`)
              ? theme.yellow300
              : theme.red300;

          const incidentStartDate = moment(incident.dateStarted).valueOf();
          const incidentCloseDate = incident.dateClosed
            ? moment(incident.dateClosed).valueOf()
            : lastPoint;
          const incidentStartValue = dataArr.find(
            point => moment(point.name).valueOf() >= incidentStartDate
          );
          series.push(
            createIncidentSeries(
              router,
              organization,
              incidentColor,
              incidentStartDate,
              incident,
              incidentStartValue,
              series[0].seriesName,
              aggregate
            )
          );
          const areaStart = Math.max(moment(incident.dateStarted).valueOf(), firstPoint);
          const areaEnd = Math.min(
            statusChanges?.length && statusChanges[0].dateCreated
              ? moment(statusChanges[0].dateCreated).valueOf() - timeWindowMs
              : moment(incidentEnd).valueOf(),
            lastPoint
          );
          const areaColor = warningTrigger ? theme.yellow300 : theme.red300;
          if (areaEnd > areaStart) {
            series.push(
              createStatusAreaSeries(areaColor, areaStart, areaEnd, minChartValue)
            );

            if (areaColor === theme.yellow300) {
              warningDuration += Math.abs(areaEnd - areaStart);
            } else {
              criticalDuration += Math.abs(areaEnd - areaStart);
            }
          }

          statusChanges?.forEach((activity, idx) => {
            const statusAreaStart = Math.max(
              moment(activity.dateCreated).valueOf() - timeWindowMs,
              firstPoint
            );
            const statusAreaEnd = Math.min(
              idx === statusChanges.length - 1
                ? moment(incidentEnd).valueOf()
                : moment(statusChanges[idx + 1].dateCreated).valueOf() - timeWindowMs,
              lastPoint
            );
            const statusAreaColor =
              activity.value === `${IncidentStatus.CRITICAL}`
                ? theme.red300
                : theme.yellow300;
            if (statusAreaEnd > statusAreaStart) {
              series.push(
                createStatusAreaSeries(
                  statusAreaColor,
                  statusAreaStart,
                  statusAreaEnd,
                  minChartValue
                )
              );
              if (statusAreaColor === theme.yellow300) {
                warningDuration += Math.abs(statusAreaEnd - statusAreaStart);
              } else {
                criticalDuration += Math.abs(statusAreaEnd - statusAreaStart);
              }
            }
          });

          if (selectedIncident && incident.id === selectedIncident.id) {
            const selectedIncidentColor =
              incidentColor === theme.yellow300 ? theme.yellow100 : theme.red100;

            areaSeries.push({
              type: 'line',
              markArea: MarkArea({
                silent: true,
                itemStyle: {
                  color: color(selectedIncidentColor).alpha(0.42).rgb().string(),
                },
                data: [[{xAxis: incidentStartDate}, {xAxis: incidentCloseDate}]] as any,
              }),
              data: [],
            });
          }
        });
    }

    let maxThresholdValue = 0;
    if (!rule.comparisonDelta && warningTrigger?.alertThreshold) {
      const {alertThreshold} = warningTrigger;
      const warningThresholdLine = createThresholdSeries(theme.yellow300, alertThreshold);
      series.push(warningThresholdLine);
      maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
    }

    if (!rule.comparisonDelta && criticalTrigger?.alertThreshold) {
      const {alertThreshold} = criticalTrigger;
      const criticalThresholdLine = createThresholdSeries(theme.red300, alertThreshold);
      series.push(criticalThresholdLine);
      maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
    }

    const comparisonSeriesName = capitalize(
      COMPARISON_DELTA_OPTIONS.find(({value}) => value === rule.comparisonDelta)?.label ||
        ''
    );

    return (
      <ChartPanel>
        <StyledPanelBody withPadding>
          <ChartHeader>
            <ChartTitle>
              {AlertWizardAlertNames[getAlertTypeFromAggregateDataset(rule)]}
            </ChartTitle>
            {query ? filter : null}
          </ChartHeader>
          {getDynamicText({
            value: (
              <ChartZoom
                router={router}
                start={start}
                end={end}
                onZoom={zoomArgs => handleZoom(zoomArgs.start, zoomArgs.end)}
              >
                {zoomRenderProps => (
                  <LineChart
                    {...zoomRenderProps}
                    isGroupedByDate
                    showTimeInTooltip
                    minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
                    forwardedRef={this.handleRef}
                    grid={{
                      left: space(0.25),
                      right: space(2),
                      top: space(2),
                      bottom: 0,
                    }}
                    yAxis={{
                      axisLabel: {
                        formatter: (value: number) =>
                          alertAxisFormatter(
                            value,
                            timeseriesData[0].seriesName,
                            rule.aggregate
                          ),
                      },
                      max:
                        maxThresholdValue > maxSeriesValue
                          ? maxThresholdValue
                          : undefined,
                      min: minChartValue || undefined,
                    }}
                    series={[...series, ...areaSeries]}
                    additionalSeries={[
                      ...(comparisonTimeseriesData || []).map(
                        ({data: _data, ...otherSeriesProps}) =>
                          LineSeries({
                            name: comparisonSeriesName,
                            data: _data.map(({name, value}) => [name, value]),
                            lineStyle: {color: theme.gray200, type: 'dashed', width: 1},
                            animation: false,
                            animationThreshold: 1,
                            animationDuration: 0,
                            ...otherSeriesProps,
                          })
                      ),
                    ]}
                    graphic={Graphic({
                      elements: this.getRuleChangeThresholdElements(timeseriesData),
                    })}
                    tooltip={{
                      formatter: seriesParams => {
                        // seriesParams can be object instead of array
                        const pointSeries = Array.isArray(seriesParams)
                          ? seriesParams
                          : [seriesParams];
                        const {marker, data: pointData, seriesName} = pointSeries[0];
                        const [pointX, pointY] = pointData as [number, number];
                        const pointYFormatted = alertTooltipValueFormatter(
                          pointY,
                          seriesName ?? '',
                          rule.aggregate
                        );

                        const comparisonSeries = pointSeries.find(
                          ({seriesName: _seriesName}) =>
                            _seriesName === comparisonSeriesName
                        );
                        const comparisonPointY = comparisonSeries
                          ? alertTooltipValueFormatter(
                              comparisonSeries.data[1],
                              seriesName ?? '',
                              rule.aggregate
                            )
                          : null;

                        const isModified =
                          dateModified && pointX <= new Date(dateModified).getTime();

                        const startTime = formatTooltipDate(moment(pointX), 'MMM D LT');
                        const {period, periodLength} = parseStatsPeriod(interval) ?? {
                          periodLength: 'm',
                          period: `${timeWindow}`,
                        };
                        const endTime = formatTooltipDate(
                          moment(pointX).add(
                            parseInt(period, 10),
                            periodLength as StatsPeriodType
                          ),
                          'MMM D LT'
                        );
                        const title = isModified
                          ? `<strong>${t('Alert Rule Modified')}</strong>`
                          : `${marker} <strong>${seriesName}</strong>`;

                        const value = isModified
                          ? `${seriesName} ${pointYFormatted}`
                          : pointYFormatted;

                        const comparisonTitle = isModified
                          ? `<span>${comparisonSeriesName}</span>`
                          : `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:transparent;"></span><strong>${comparisonSeriesName}</strong>`;

                        return [
                          `<div class="tooltip-series">`,
                          `<div><span class="tooltip-label">${title}</span>${value}</div>`,
                          comparisonSeries &&
                            `<div><span class="tooltip-label">${comparisonTitle}</span>${comparisonPointY}</div>`,
                          `</div>`,
                          `<div class="tooltip-date">${startTime} &mdash; ${endTime}</div>`,
                          `<div class="tooltip-arrow"></div>`,
                        ]
                          .filter(e => e)
                          .join('');
                      },
                    }}
                    onFinished={() => {
                      // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
                      // any graphics related to the triggers (e.g. the threshold areas + boundaries)
                      this.updateDimensions();
                    }}
                  />
                )}
              </ChartZoom>
            ),
            fixed: <Placeholder height="200px" testId="skeleton-ui" />,
          })}
        </StyledPanelBody>
        {this.renderChartActions(totalDuration, criticalDuration, warningDuration)}
      </ChartPanel>
    );
  }

  renderEmpty() {
    return (
      <ChartPanel>
        <PanelBody withPadding>
          <Placeholder height="200px" />
        </PanelBody>
      </ChartPanel>
    );
  }

  render() {
    const {api, rule, organization, timePeriod, projects, interval, query} = this.props;
    const {aggregate, timeWindow, environment, dataset} = rule;

    // If the chart duration isn't as long as the rollup duration the events-stats
    // endpoint will return an invalid timeseriesData data set
    const viableStartDate = getUtcDateString(
      moment.min(
        moment.utc(timePeriod.start),
        moment.utc(timePeriod.end).subtract(timeWindow, 'minutes')
      )
    );

    const viableEndDate = getUtcDateString(
      moment.utc(timePeriod.end).add(timeWindow, 'minutes')
    );

    return dataset === Dataset.SESSIONS ? (
      <SessionsRequest
        api={api}
        organization={organization}
        project={projects.filter(p => p.id).map(p => Number(p.id))}
        environment={environment ? [environment] : undefined}
        start={viableStartDate}
        end={viableEndDate}
        query={query}
        interval={interval}
        field={SESSION_AGGREGATE_TO_FIELD[aggregate]}
        groupBy={['session.status']}
      >
        {({loading, response}) =>
          this.renderChart(
            loading,
            [
              {
                seriesName:
                  AlertWizardAlertNames[
                    getAlertTypeFromAggregateDataset({
                      aggregate,
                      dataset: Dataset.SESSIONS,
                    })
                  ],
                data: getCrashFreeRateSeries(
                  response?.groups,
                  response?.intervals,
                  SESSION_AGGREGATE_TO_FIELD[aggregate]
                ),
              },
            ],
            MINUTES_THRESHOLD_TO_DISPLAY_SECONDS
          )
        }
      </SessionsRequest>
    ) : (
      <EventsRequest
        api={api}
        organization={organization}
        query={query}
        environment={environment ? [environment] : undefined}
        project={(projects as Project[])
          .filter(p => p && p.slug)
          .map(project => Number(project.id))}
        interval={interval}
        comparisonDelta={rule.comparisonDelta ? rule.comparisonDelta * 60 : undefined}
        start={viableStartDate}
        end={viableEndDate}
        yAxis={aggregate}
        includePrevious={false}
        currentSeriesNames={[aggregate]}
        partial={false}
        referrer="api.alerts.alert-rule-chart"
      >
        {({loading, timeseriesData, comparisonTimeseriesData}) =>
          this.renderChart(loading, timeseriesData, undefined, comparisonTimeseriesData)
        }
      </EventsRequest>
    );
  }
}

export default withRouter(MetricChart);

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const ChartTitle = styled('header')`
  display: flex;
  flex-direction: row;
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${space(1)} 20px;
`;

const ChartSummary = styled('div')`
  display: flex;
  margin-right: auto;
`;

const SummaryText = styled(SectionHeading)`
  flex: 1;
  display: flex;
  align-items: center;
  margin: 0;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
`;

const SummaryStats = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(2)};
`;

const StatItem = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(2)} 0 0;
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;

const StatCount = styled('span')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  color: ${p => p.theme.textColor};
`;
