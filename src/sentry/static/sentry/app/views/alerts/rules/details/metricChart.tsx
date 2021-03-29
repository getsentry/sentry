import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';
import color from 'color';
import moment from 'moment';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import Graphic from 'app/components/charts/components/graphic';
import MarkLine from 'app/components/charts/components/markLine';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart, {LineChartSeries} from 'app/components/charts/lineChart';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {AvatarProject, Organization, Project} from 'app/types';
import {ReactEchartsRef} from 'app/types/echarts';
import {getFormattedDate} from 'app/utils/dates';
import theme from 'app/utils/theme';
import {makeDefaultCta} from 'app/views/settings/incidentRules/incidentRulePresets';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

import {Incident, IncidentActivityType, IncidentStatus} from '../../types';
import {getIncidentRuleMetricPreset} from '../../utils';

const X_AXIS_BOUNDARY_GAP = 15;
const VERTICAL_PADDING = 22;

type Props = WithRouterProps & {
  api: Client;
  rule?: IncidentRule;
  incidents?: Incident[];
  timePeriod: {
    start: string;
    end: string;
    label: string;
    custom?: boolean;
  };
  organization: Organization;
  projects: Project[] | AvatarProject[];
  metricText: React.ReactNode;
  interval: string;
  query: string;
  orgId: string;
};

type State = {
  width: number;
  height: number;
};

function createThresholdSeries(lineColor: string, threshold: number): LineChartSeries {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold} as any],
    }),
    data: [],
  };
}

function createStatusAreaSeries(
  lineColor: string,
  startTime: number,
  endTime: number,
  startLimit?: number,
  endLimit?: number
): LineChartSeries {
  return {
    seriesName: 'Status Area',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'solid', width: 4},
      data: [
        [
          {coord: [startLimit ? Math.max(startTime, startLimit) : startTime, 0]},
          {coord: [endLimit ? Math.min(endLimit, endTime) : endTime, 0]},
        ] as any,
      ],
    }),
    data: [],
  };
}

function createIncidentSeries(
  router: Props['router'],
  orgSlug: string,
  lineColor: string,
  incidentTimestamp: number,
  identifier?: string,
  dataPoint?: LineChartSeries['data'][0],
  seriesName?: string
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
              pathname: `/organizations/${orgSlug}/alerts/${identifier}/`,
              query: {redirect: false},
            });
          },
        },
      ] as any,
      label: {
        show: !!identifier,
        position: 'insideEndBottom',
        formatter: identifier || '-',
        color: lineColor,
        fontSize: 10,
      } as any,
    }),
    data: [],
  };
  // tooltip conflicts with MarkLine types
  (series.markLine as any).tooltip = {
    trigger: 'item',
    alwaysShowContent: true,
    formatter: ({value, marker}) => {
      const time = getFormattedDate(value, 'MMM D, YYYY LT');
      return [
        `<div class="tooltip-series"><div>`,
        `<span class="tooltip-label">${marker} <strong>${t(
          'Alert'
        )} #${identifier}</strong></span>${seriesName} ${dataPoint?.value}</div></div>`,
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

  get metricPreset() {
    const {rule} = this.props;
    return rule ? getIncidentRuleMetricPreset(rule) : undefined;
  }

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

  getRuleChangeThresholdElements = data => {
    const {height, width} = this.state;
    const {dateModified} = this.props.rule || {};

    if (!data.length || !data[0].data.length || !dateModified) {
      return [];
    }

    const seriesData = data[0].data;
    const seriesStart = seriesData[0].name as number;
    const seriesEnd = seriesData[seriesData.length - 1].name as number;
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
        z: 100,
      },
    ];
  };

  renderChartActions(
    totalDuration: number,
    criticalDuration: number,
    warningDuration: number
  ) {
    const {rule, orgId, projects, timePeriod} = this.props;
    const preset = this.metricPreset;
    const ctaOpts = {
      orgSlug: orgId,
      projects: projects as Project[],
      rule,
      start: timePeriod.start,
      end: timePeriod.end,
    };

    const {buttonText, ...props} = preset
      ? preset.makeCtaParams(ctaOpts)
      : makeDefaultCta(ctaOpts);

    const resolvedPercent = (
      (100 * Math.max(totalDuration - criticalDuration - warningDuration, 0)) /
      totalDuration
    ).toFixed(2);
    const criticalPercent = (100 * Math.min(criticalDuration / totalDuration, 1)).toFixed(
      2
    );
    const warningPercent = (100 * Math.min(warningDuration / totalDuration, 1)).toFixed(
      2
    );

    return (
      <ChartActions>
        <ChartSummary>
          <SummaryText>{t('SUMMARY')}</SummaryText>
          <SummaryStats>
            <StatItem>
              <IconCheckmark color="green300" isCircled />
              <StatCount>{resolvedPercent}%</StatCount>
            </StatItem>
            <StatItem>
              <IconWarning color="yellow300" />
              <StatCount>{warningPercent}%</StatCount>
            </StatItem>
            <StatItem>
              <IconFire color="red300" />
              <StatCount>{criticalPercent}%</StatCount>
            </StatItem>
          </SummaryStats>
        </ChartSummary>
        <Feature features={['discover-basic']}>
          <Button size="small" disabled={!rule} {...props}>
            {buttonText}
          </Button>
        </Feature>
      </ChartActions>
    );
  }

  renderChart(
    data: LineChartSeries[],
    series: LineChartSeries[],
    maxThresholdValue: number,
    maxSeriesValue: number
  ) {
    return (
      <LineChart
        isGroupedByDate
        showTimeInTooltip
        forwardedRef={this.handleRef}
        grid={{
          left: 0,
          right: 0,
          top: space(2),
          bottom: 0,
        }}
        yAxis={maxThresholdValue > maxSeriesValue ? {max: maxThresholdValue} : undefined}
        series={series}
        graphic={Graphic({
          elements: this.getRuleChangeThresholdElements(data),
        })}
        onFinished={() => {
          // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
          // any graphics related to the triggers (e.g. the threshold areas + boundaries)
          this.updateDimensions();
        }}
      />
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
    const {
      api,
      router,
      rule,
      organization,
      timePeriod,
      projects,
      interval,
      metricText,
      query,
      incidents,
    } = this.props;

    if (!rule) {
      return this.renderEmpty();
    }

    const criticalTrigger = rule.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule.triggers.find(({label}) => label === 'warning');

    return (
      <EventsRequest
        api={api}
        organization={organization}
        query={query}
        environment={rule.environment ? [rule.environment] : undefined}
        project={(projects as Project[]).map(project => Number(project.id))}
        interval={interval}
        start={timePeriod.start}
        end={timePeriod.end}
        yAxis={rule.aggregate}
        includePrevious={false}
        currentSeriesName={rule.aggregate}
        partial={false}
      >
        {({loading, timeseriesData}) => {
          if (loading || !timeseriesData) {
            return this.renderEmpty();
          }

          const series: LineChartSeries[] = [...timeseriesData];
          // Ensure series data appears above incident lines
          series[0].z = 100;
          const dataArr = timeseriesData[0].data;
          const maxSeriesValue = dataArr.reduce(
            (currMax, coord) => Math.max(currMax, coord.value),
            0
          );
          const firstPoint = Number(dataArr[0].name);
          const lastPoint = dataArr[dataArr.length - 1].name as number;
          const totalDuration = lastPoint - firstPoint;
          let criticalDuration = 0;
          let warningDuration = 0;

          series.push(createStatusAreaSeries(theme.green300, firstPoint, lastPoint));
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
                      [
                        `${IncidentStatus.WARNING}`,
                        `${IncidentStatus.CRITICAL}`,
                      ].includes(value)
                  )
                  .sort(
                    (a, b) =>
                      moment(a.dateCreated).valueOf() - moment(b.dateCreated).valueOf()
                  );

                const incidentEnd = incident.dateClosed ?? moment().valueOf();

                const timeWindowMs = rule.timeWindow * 60 * 1000;

                const areaStart = moment(incident.dateStarted).valueOf();
                const incidentStartValue = dataArr.find(point => point.name >= areaStart);
                series.push(
                  createIncidentSeries(
                    router,
                    organization.slug,
                    warningTrigger &&
                      statusChanges &&
                      !statusChanges.find(
                        ({value}) => value === `${IncidentStatus.CRITICAL}`
                      )
                      ? theme.yellow300
                      : theme.red300,
                    areaStart,
                    incident.identifier,
                    incidentStartValue,
                    series[0].seriesName
                  )
                );
                const areaEnd =
                  statusChanges?.length && statusChanges[0].dateCreated
                    ? moment(statusChanges[0].dateCreated).valueOf() - timeWindowMs
                    : moment(incidentEnd).valueOf();
                const areaColor = warningTrigger ? theme.yellow300 : theme.red300;
                series.push(
                  createStatusAreaSeries(
                    areaColor,
                    areaStart,
                    areaEnd,
                    firstPoint,
                    lastPoint
                  )
                );
                if (areaColor === theme.yellow300) {
                  warningDuration += areaEnd - areaStart;
                } else {
                  criticalDuration += areaEnd - areaStart;
                }

                statusChanges?.forEach((activity, idx) => {
                  const statusAreaStart =
                    moment(activity.dateCreated).valueOf() - timeWindowMs;
                  const statusAreaColor =
                    activity.value === `${IncidentStatus.CRITICAL}`
                      ? theme.red300
                      : theme.yellow300;
                  const statusAreaEnd =
                    idx === statusChanges.length - 1
                      ? moment(incidentEnd).valueOf()
                      : moment(statusChanges[idx + 1].dateCreated).valueOf() -
                        timeWindowMs;
                  series.push(
                    createStatusAreaSeries(
                      statusAreaColor,
                      areaStart,
                      statusAreaEnd,
                      firstPoint,
                      lastPoint
                    )
                  );
                  if (statusAreaColor === theme.yellow300) {
                    warningDuration += statusAreaEnd - statusAreaStart;
                  } else {
                    criticalDuration += statusAreaEnd - statusAreaStart;
                  }
                });
              });
          }

          let maxThresholdValue = 0;
          if (warningTrigger?.alertThreshold) {
            const {alertThreshold} = warningTrigger;
            const warningThresholdLine = createThresholdSeries(
              theme.yellow300,
              alertThreshold
            );
            series.push(warningThresholdLine);
            maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
          }

          if (criticalTrigger?.alertThreshold) {
            const {alertThreshold} = criticalTrigger;
            const criticalThresholdLine = createThresholdSeries(
              theme.red300,
              alertThreshold
            );
            series.push(criticalThresholdLine);
            maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
          }

          return (
            <ChartPanel>
              <PanelBody withPadding>
                <ChartHeader>
                  <PresetName>{this.metricPreset?.name ?? t('Custom metric')}</PresetName>
                  {metricText}
                </ChartHeader>
                {this.renderChart(
                  timeseriesData,
                  series,
                  maxThresholdValue,
                  maxSeriesValue
                )}
              </PanelBody>
              {this.renderChartActions(totalDuration, criticalDuration, warningDuration)}
            </ChartPanel>
          );
        }}
      </EventsRequest>
    );
  }
}

export default withRouter(MetricChart);

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const ChartHeader = styled('header')`
  margin-bottom: ${space(1)};
  display: flex;
  flex-direction: row;
`;

const PresetName = styled('div')`
  text-transform: capitalize;
  margin-right: ${space(0.5)};
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

const SummaryText = styled('span')`
  margin-top: ${space(0.25)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
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

const StatCount = styled('span')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  color: ${p => p.theme.textColor};
`;
