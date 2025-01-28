import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import color from 'color';
import type {LineSeriesOption} from 'echarts';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {OnDemandMetricAlert} from 'sentry/components/alerts/onDemandMetricAlert';
import {Button} from 'sentry/components/button';
import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
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
import {isEmptySeries} from 'sentry/components/charts/utils';
import CircleIndicator from 'sentry/components/circleIndicator';
import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconClock, IconFire, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {DateString} from 'sentry/types/core';
import type {ReactEchartsRef, Series} from 'sentry/types/echarts';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import toArray from 'sentry/utils/array/toArray';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {getForceMetricsLayerQueryExtras} from 'sentry/utils/metrics/features';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {MINUTES_THRESHOLD_TO_DISPLAY_SECONDS} from 'sentry/utils/sessions';
import {capitalize} from 'sentry/utils/string/capitalize';
import theme from 'sentry/utils/theme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {makeDefaultCta} from 'sentry/views/alerts/rules/metric/metricRulePresets';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleTriggerType,
  Dataset,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {getChangeStatus} from 'sentry/views/alerts/utils/getChangeStatus';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import type {Anomaly, Incident} from '../../../types';
import {
  alertDetailsLink,
  alertTooltipValueFormatter,
  isSessionAggregate,
  SESSION_AGGREGATE_TO_FIELD,
} from '../../../utils';
import {getMetricDatasetQueryExtras} from '../utils/getMetricDatasetQueryExtras';
import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

import type {TimePeriodType} from './constants';
import {
  getMetricAlertChartOption,
  transformSessionResponseToSeries,
} from './metricChartOption';

type Props = WithRouterProps & {
  api: Client;
  filter: string[] | null;
  interval: string;
  organization: Organization;
  project: Project;
  query: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
  anomalies?: Anomaly[];
  formattedAggregate?: string;
  incidents?: Incident[];
  isOnDemandAlert?: boolean;
};

type State = Record<string, never>;

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  const {
    options: {timezone},
  } = ConfigStore.get('user');
  return moment.tz(date, timezone).format(format);
}

function getRuleChangeSeries(
  rule: MetricRule,
  data: AreaChartSeries[]
): LineSeriesOption[] {
  const {dateModified} = rule;
  if (!data.length || !data[0]!.data.length || !dateModified) {
    return [];
  }

  const seriesData = data[0]!.data;
  const seriesStart = new Date(seriesData[0]!.name).getTime();
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

function shouldUseErrorsDataset(dataset: Dataset, query: string): boolean {
  return dataset === Dataset.ERRORS && /\bis:unresolved\b/.test(query);
}

class MetricChart extends PureComponent<Props, State> {
  ref: null | ReactEchartsRef = null;

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
    warningDuration: number,
    waitingForDataDuration: number
  ) {
    const {rule, organization, project, timePeriod, query} = this.props;

    let dataset: DiscoverDatasets | undefined = undefined;
    if (shouldUseErrorsDataset(rule.dataset, query)) {
      dataset = DiscoverDatasets.ERRORS;
    }

    let openInDiscoverDataset: SavedQueryDatasets | undefined = undefined;
    if (hasDatasetSelector(organization)) {
      if (rule.dataset === Dataset.ERRORS) {
        openInDiscoverDataset = SavedQueryDatasets.ERRORS;
      } else if (
        rule.dataset === Dataset.TRANSACTIONS ||
        rule.dataset === Dataset.GENERIC_METRICS
      ) {
        openInDiscoverDataset = SavedQueryDatasets.TRANSACTIONS;
      }
    }

    const {buttonText, ...props} = makeDefaultCta({
      organization,
      projects: [project],
      rule,
      timePeriod,
      query,
      dataset,
      openInDiscoverDataset,
    });

    const resolvedPercent =
      (100 *
        Math.max(
          totalDuration - waitingForDataDuration - criticalDuration - warningDuration,
          0
        )) /
      totalDuration;
    const criticalPercent = 100 * Math.min(criticalDuration / totalDuration, 1);
    const warningPercent = 100 * Math.min(warningDuration / totalDuration, 1);
    const waitingForDataPercent =
      100 *
      Math.min(
        (waitingForDataDuration - criticalDuration - warningDuration) / totalDuration,
        1
      );

    return (
      <StyledChartControls>
        <StyledInlineContainer>
          <Fragment>
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
              {waitingForDataPercent > 0 && (
                <StyledTooltip
                  underlineColor="gray200"
                  showUnderline
                  title={t(
                    'The time spent waiting for metrics matching the filters used.'
                  )}
                >
                  <ValueItem>
                    <IconClock />
                    {waitingForDataPercent.toFixed(2)}%
                  </ValueItem>
                </StyledTooltip>
              )}
            </StyledSectionValue>
          </Fragment>
        </StyledInlineContainer>
        {!isSessionAggregate(rule.aggregate) &&
          (getAlertTypeFromAggregateDataset(rule) === 'eap_metrics' ? (
            <Feature features="visibility-explore-view">
              <Button size="sm" {...props}>
                {buttonText}
              </Button>
            </Feature>
          ) : (
            <Feature features="discover-basic">
              <Button size="sm" {...props}>
                {buttonText}
              </Button>
            </Feature>
          ))}
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
      anomalies,
      router,
      interval,
      filter,
      incidents,
      rule,
      organization,
      timePeriod: {start, end},
      formattedAggregate,
    } = this.props;
    const {dateModified, timeWindow} = rule;

    if (loading || !timeseriesData) {
      return this.renderEmpty();
    }

    const handleIncidentClick = (incident: Incident) => {
      router.push(
        normalizeUrl({
          pathname: alertDetailsLink(organization, incident),
          query: {alert: incident.identifier},
        })
      );
    };

    const {
      criticalDuration,
      warningDuration,
      totalDuration,
      waitingForDataDuration,
      chartOption,
    } = getMetricAlertChartOption({
      timeseriesData,
      rule,
      seriesName: formattedAggregate,
      incidents,
      anomalies,
      showWaitingForData:
        shouldShowOnDemandMetricAlertUI(organization) && this.props.isOnDemandAlert,
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
            <Filters>{formattedAggregate ?? rule.aggregate}</Filters>
            <Tooltip
              title={queryFilter}
              isHoverable
              skipWrapper
              overlayStyle={{maxWidth: '90vw', lineBreak: 'anywhere', textAlign: 'left'}}
              showOnlyOnOverflow
            >
              <QueryFilters>{queryFilter}</QueryFilters>
            </Tooltip>
          </ChartFilters>
          {getDynamicText({
            value: (
              <ChartZoom
                start={start}
                end={end}
                onZoom={zoomArgs => this.handleZoom(zoomArgs.start, zoomArgs.end)}
              >
                {zoomRenderProps => (
                  <AreaChart
                    {...zoomRenderProps}
                    {...chartOption}
                    showTimeInTooltip
                    minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
                    additionalSeries={additionalSeries}
                    tooltip={{
                      formatter: seriesParams => {
                        // seriesParams can be object instead of array
                        const pointSeries = toArray(seriesParams);
                        // @ts-expect-error TS(2339): Property 'marker' does not exist on type 'Callback... Remove this comment to see the full error message
                        const {marker, data: pointData} = pointSeries[0];
                        const seriesName =
                          formattedAggregate ?? pointSeries[0]?.seriesName ?? '';
                        const [pointX, pointY] = pointData as [number, number];
                        const pointYFormatted = alertTooltipValueFormatter(
                          pointY,
                          seriesName,
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
                          moment(pointX).add(parseInt(period!, 10), periodLength),
                          'MMM D LT'
                        );

                        const comparisonSeries =
                          pointSeries.length > 1
                            ? pointSeries.find(
                                ({seriesName: _sn}) => _sn === comparisonSeriesName
                              )
                            : undefined;

                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        const comparisonPointY = comparisonSeries?.data[1] as
                          | number
                          | undefined;
                        const comparisonPointYFormatted =
                          comparisonPointY !== undefined
                            ? alertTooltipValueFormatter(
                                comparisonPointY,
                                seriesName,
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
                          `<div class="tooltip-footer">`,
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
        {this.renderChartActions(
          totalDuration,
          criticalDuration,
          warningDuration,
          waitingForDataDuration
        )}
      </ChartPanel>
    );
  }

  renderEmptyOnDemandAlert(
    organization: Organization,
    timeseriesData: Series[] = [],
    loading?: boolean
  ) {
    if (
      loading ||
      !this.props.isOnDemandAlert ||
      !shouldShowOnDemandMetricAlertUI(organization) ||
      !isEmptySeries(timeseriesData[0]!)
    ) {
      return null;
    }

    return (
      <OnDemandMetricAlert
        dismissable
        message={t(
          'This alert lacks historical data due to filters for which we don’t routinely extract metrics.'
        )}
      />
    );
  }

  renderEmpty(placeholderText = '') {
    return (
      <ChartPanel>
        <PanelBody withPadding>
          <TriggerChartPlaceholder>{placeholderText}</TriggerChartPlaceholder>
        </PanelBody>
      </ChartPanel>
    );
  }

  render() {
    const {
      api,
      rule,
      organization,
      timePeriod,
      project,
      interval,
      query,
      location,
      isOnDemandAlert,
    } = this.props;
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

    const queryExtras: Record<string, string> = {
      ...getMetricDatasetQueryExtras({
        organization,
        location,
        dataset,
        newAlertOrQuery: false,
        useOnDemandMetrics: isOnDemandAlert,
      }),
      ...getForceMetricsLayerQueryExtras(organization, dataset),
    };

    if (shouldUseErrorsDataset(dataset, query)) {
      queryExtras.dataset = 'errors';
    }

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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
        useRpc={dataset === Dataset.EVENTS_ANALYTICS_PLATFORM}
        useOnDemandMetrics
      >
        {({loading, timeseriesData, comparisonTimeseriesData}) => (
          <Fragment>
            {this.renderEmptyOnDemandAlert(organization, timeseriesData, loading)}
            {this.renderChart(
              loading,
              timeseriesData,
              undefined,
              comparisonTimeseriesData
            )}
          </Fragment>
        )}
      </EventsRequest>
    );
  }
}

export default withSentryRouter(MetricChart);

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
  grid-template-columns: max-content max-content auto;
  align-items: center;
`;

const Filters = styled('span')`
  margin-right: ${space(1)};
`;

const QueryFilters = styled('span')`
  min-width: 0px;
  ${p => p.theme.overflowEllipsis}
`;

const StyledSectionValue = styled(SectionValue)`
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: ${space(1.5)};
  margin: 0 0 0 ${space(1.5)};
`;

const ValueItem = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: ${space(0.5)};
  align-items: center;
  font-variant-numeric: tabular-nums;
  text-underline-offset: ${space(4)};
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;

const TriggerChartPlaceholder = styled(Placeholder)`
  height: 200px;
  text-align: center;
  padding: ${space(3)};
`;

const StyledTooltip = styled(Tooltip)`
  text-underline-offset: ${space(0.5)} !important;
`;
