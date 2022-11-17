import {PureComponent} from 'react';
// eslint-disable-next-line no-restricted-imports
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import color from 'color';
import type {LineSeriesOption} from 'echarts';
import capitalize from 'lodash/capitalize';
import moment from 'moment';
import momentTimezone from 'moment-timezone';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import {AreaChart, AreaChartSeries} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {
  ChartControls,
  HeaderTitleLegend,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import CircleIndicator from 'sentry/components/circleIndicator';
import {
  parseStatsPeriod,
  StatsPeriodType,
} from 'sentry/components/organizations/pageFilters/parse';
import {Panel, PanelBody} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import Truncate from 'sentry/components/truncate';
import {IconCheckmark, IconFire, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {DateString, Organization, Project} from 'sentry/types';
import {ReactEchartsRef, Series} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {MINUTES_THRESHOLD_TO_DISPLAY_SECONDS} from 'sentry/utils/sessions';
import theme from 'sentry/utils/theme';
import toArray from 'sentry/utils/toArray';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {makeDefaultCta} from 'sentry/views/alerts/rules/metric/metricRulePresets';
import {
  AlertRuleTriggerType,
  MetricRule,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {getChangeStatus} from 'sentry/views/alerts/utils/getChangeStatus';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {Incident} from '../../../types';
import {
  alertDetailsLink,
  alertTooltipValueFormatter,
  isSessionAggregate,
  SESSION_AGGREGATE_TO_FIELD,
} from '../../../utils';
import {getMetricDatasetQueryExtras} from '../utils/getMetricDatasetQueryExtras';
import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

import {TimePeriodType} from './constants';
import {
  getMetricAlertChartOption,
  transformSessionResponseToSeries,
} from './metricChartOption';

type Props = WithRouterProps & {
  api: Client;
  filter: string[] | null;
  interval: string;
  orgId: string;
  organization: Organization;
  project: Project;
  query: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
  incidents?: Incident[];
  selectedIncident?: Incident | null;
};

type State = {
  height: number;
  width: number;
};

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  const {
    options: {timezone},
  } = ConfigStore.get('user');
  return momentTimezone.tz(date, timezone).format(format);
}

function getRuleChangeSeries(
  rule: MetricRule,
  data: AreaChartSeries[]
): LineSeriesOption[] {
  const {dateModified} = rule;
  if (!data.length || !data[0].data.length || !dateModified) {
    return [];
  }

  const seriesData = data[0].data;
  const seriesStart = new Date(seriesData[0].name).getTime();
  const ruleChanged = new Date(dateModified).getTime();

  if (ruleChanged < seriesStart) {
    return [];
  }

  return [
    {
      type: 'line',
      markLine: MarkLine({
        silent: true,
        animation: false,
        lineStyle: {color: theme.gray200, type: 'solid', width: 1},
        data: [{xAxis: ruleChanged}],
        label: {
          show: false,
        },
      }),
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: color(theme.gray100).alpha(0.42).rgb().string(),
        },
        data: [[{xAxis: seriesStart}, {xAxis: ruleChanged}]],
      }),
      data: [],
    },
  ];
}

class MetricChart extends PureComponent<Props, State> {
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

  handleZoom = (start: DateString, end: DateString) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {
        start,
        end,
      },
    });
  };

  renderChartActions(
    totalDuration: number,
    criticalDuration: number,
    warningDuration: number
  ) {
    const {rule, orgId, project, timePeriod, query} = this.props;

    const {buttonText, ...props} = makeDefaultCta({
      orgSlug: orgId,
      projects: [project],
      rule,
      timePeriod,
      query,
    });

    const resolvedPercent =
      (100 * Math.max(totalDuration - criticalDuration - warningDuration, 0)) /
      totalDuration;
    const criticalPercent = 100 * Math.min(criticalDuration / totalDuration, 1);
    const warningPercent = 100 * Math.min(warningDuration / totalDuration, 1);

    return (
      <StyledChartControls>
        <StyledInlineContainer>
          <SectionHeading>{t('Summary')}</SectionHeading>
          <StyledSectionValue>
            <ValueItem>
              <IconCheckmark color="successText" isCircled />
              {resolvedPercent ? resolvedPercent.toFixed(2) : 0}%
            </ValueItem>
            <ValueItem>
              <IconWarning color="warningText" />
              {warningPercent ? warningPercent.toFixed(2) : 0}%
            </ValueItem>
            <ValueItem>
              <IconFire color="errorText" />
              {criticalPercent ? criticalPercent.toFixed(2) : 0}%
            </ValueItem>
          </StyledSectionValue>
        </StyledInlineContainer>
        {!isSessionAggregate(rule.aggregate) && (
          <Feature features={['discover-basic']}>
            <Button size="sm" {...props}>
              {buttonText}
            </Button>
          </Feature>
        )}
      </StyledChartControls>
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
      filter,
      incidents,
      rule,
      organization,
      timePeriod: {start, end},
    } = this.props;
    const {width} = this.state;
    const {dateModified, timeWindow} = rule;

    if (loading || !timeseriesData) {
      return this.renderEmpty();
    }

    const handleIncidentClick = (incident: Incident) => {
      router.push({
        pathname: alertDetailsLink(organization, incident),
        query: {alert: incident.identifier},
      });
    };

    const {criticalDuration, warningDuration, totalDuration, chartOption} =
      getMetricAlertChartOption({
        timeseriesData,
        rule,
        incidents,
        selectedIncident,
        handleIncidentClick,
      });

    const comparisonSeriesName = capitalize(
      COMPARISON_DELTA_OPTIONS.find(({value}) => value === rule.comparisonDelta)?.label ||
        ''
    );

    const additionalSeries: LineSeriesOption[] = [
      ...(comparisonTimeseriesData || []).map(({data: _data, ...otherSeriesProps}) =>
        LineSeries({
          name: comparisonSeriesName,
          data: _data.map(({name, value}) => [name, value]),
          lineStyle: {color: theme.gray200, type: 'dashed', width: 1},
          itemStyle: {color: theme.gray200},
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          ...otherSeriesProps,
        })
      ),
      ...getRuleChangeSeries(rule, timeseriesData),
    ];

    const queryFilter =
      filter?.join(' ') + t(' over ') + getDuration(rule.timeWindow * 60);

    const percentOfWidth =
      width >= 1151
        ? 15
        : width < 1151 && width >= 700
        ? 14
        : width < 700 && width >= 515
        ? 13
        : width < 515 && width >= 300
        ? 12
        : 8;
    const truncateWidth = (percentOfWidth / 100) * width;

    return (
      <ChartPanel>
        <StyledPanelBody withPadding>
          <ChartHeader>
            <HeaderTitleLegend>
              {AlertWizardAlertNames[getAlertTypeFromAggregateDataset(rule)]}
            </HeaderTitleLegend>
          </ChartHeader>
          <ChartFilters>
            <StyledCircleIndicator size={8} />
            <Filters>{rule.aggregate}</Filters>
            <Truncate value={queryFilter ?? ''} maxLength={truncateWidth} />
          </ChartFilters>
          {getDynamicText({
            value: (
              <ChartZoom
                router={router}
                start={start}
                end={end}
                onZoom={zoomArgs => this.handleZoom(zoomArgs.start, zoomArgs.end)}
                onFinished={() => {
                  // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
                  // any graphics related to the triggers (e.g. the threshold areas + boundaries)
                  this.updateDimensions();
                }}
              >
                {zoomRenderProps => (
                  <AreaChart
                    {...zoomRenderProps}
                    {...chartOption}
                    showTimeInTooltip
                    minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
                    forwardedRef={this.handleRef}
                    additionalSeries={additionalSeries}
                    tooltip={{
                      formatter: seriesParams => {
                        // seriesParams can be object instead of array
                        const pointSeries = toArray(seriesParams);
                        const {marker, data: pointData, seriesName} = pointSeries[0];
                        const [pointX, pointY] = pointData as [number, number];
                        const pointYFormatted = alertTooltipValueFormatter(
                          pointY,
                          seriesName ?? '',
                          rule.aggregate
                        );

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

                        const comparisonSeries =
                          pointSeries.length > 1
                            ? pointSeries.find(
                                ({seriesName: _sn}) => _sn === comparisonSeriesName
                              )
                            : undefined;

                        const comparisonPointY = comparisonSeries?.data[1] as
                          | number
                          | undefined;
                        const comparisonPointYFormatted =
                          comparisonPointY !== undefined
                            ? alertTooltipValueFormatter(
                                comparisonPointY,
                                seriesName ?? '',
                                rule.aggregate
                              )
                            : undefined;

                        const changePercentage =
                          comparisonPointY === undefined
                            ? NaN
                            : ((pointY - comparisonPointY) * 100) / comparisonPointY;

                        const changeStatus = getChangeStatus(
                          changePercentage,
                          rule.thresholdType,
                          rule.triggers
                        );

                        const changeStatusColor =
                          changeStatus === AlertRuleTriggerType.CRITICAL
                            ? theme.red300
                            : changeStatus === AlertRuleTriggerType.WARNING
                            ? theme.yellow300
                            : theme.green300;

                        return [
                          `<div class="tooltip-series">`,
                          isModified &&
                            `<div><span class="tooltip-label"><strong>${t(
                              'Alert Rule Modified'
                            )}</strong></span></div>`,
                          `<div><span class="tooltip-label">${marker} <strong>${seriesName}</strong></span>${pointYFormatted}</div>`,
                          comparisonSeries &&
                            `<div><span class="tooltip-label">${comparisonSeries.marker} <strong>${comparisonSeriesName}</strong></span>${comparisonPointYFormatted}</div>`,
                          `</div>`,
                          `<div class="tooltip-date">`,
                          `<span>${startTime} &mdash; ${endTime}</span>`,
                          comparisonPointY !== undefined &&
                            Math.abs(changePercentage) !== Infinity &&
                            !isNaN(changePercentage) &&
                            `<span style="color:${changeStatusColor};margin-left:10px;">${
                              Math.sign(changePercentage) === 1 ? '+' : '-'
                            }${Math.abs(changePercentage).toFixed(2)}%</span>`,
                          `</div>`,
                          '<div class="tooltip-arrow"></div>',
                        ]
                          .filter(e => e)
                          .join('');
                      },
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
    const {api, rule, organization, timePeriod, project, interval, query, location} =
      this.props;
    const {aggregate, timeWindow, environment, dataset} = rule;

    // Fix for 7 days * 1m interval being over the max number of results from events api
    // 10k events is the current max
    if (
      timePeriod.usingPeriod &&
      timePeriod.period === TimePeriod.SEVEN_DAYS &&
      interval === '1m'
    ) {
      timePeriod.start = getUtcDateString(
        // -5 minutes provides a small cushion for rounding up minutes. This might be able to be smaller
        moment(moment.utc(timePeriod.end).subtract(10000 - 5, 'minutes'))
      );
    }

    // If the chart duration isn't as long as the rollup duration the events-stats
    // endpoint will return an invalid timeseriesData dataset
    const viableStartDate = getUtcDateString(
      moment.min(
        moment.utc(timePeriod.start),
        moment.utc(timePeriod.end).subtract(timeWindow, 'minutes')
      )
    );

    const viableEndDate = getUtcDateString(
      moment.utc(timePeriod.end).add(timeWindow, 'minutes')
    );

    const queryExtras = getMetricDatasetQueryExtras({
      organization,
      location,
      dataset,
      newAlertOrQuery: false,
    });

    return isCrashFreeAlert(dataset) ? (
      <SessionsRequest
        api={api}
        organization={organization}
        project={project.id ? [Number(project.id)] : []}
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
            transformSessionResponseToSeries(response, rule),
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
        project={project.id ? [Number(project.id)] : []}
        interval={interval}
        comparisonDelta={rule.comparisonDelta ? rule.comparisonDelta * 60 : undefined}
        start={viableStartDate}
        end={viableEndDate}
        yAxis={aggregate}
        includePrevious={false}
        currentSeriesNames={[aggregate]}
        partial={false}
        queryExtras={queryExtras}
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

const StyledChartControls = styled(ChartControls)`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const StyledInlineContainer = styled(InlineContainer)`
  grid-auto-flow: column;
  grid-column-gap: ${space(1)};
`;

const StyledCircleIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.formText};
  height: ${space(1)};
  margin-right: ${space(0.5)};
`;

const ChartFilters = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.textColor};
  display: inline-grid;
  grid-template-columns: repeat(3, max-content);
  align-items: center;
`;

const Filters = styled('span')`
  margin-right: ${space(1)};
`;

const StyledSectionValue = styled(SectionValue)`
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: ${space(1.5)};
  margin: 0 0 0 ${space(1.5)};
`;

const ValueItem = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: ${space(0.5)};
  align-items: center;
  font-variant-numeric: tabular-nums;
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;
