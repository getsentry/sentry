import styled from '@emotion/styled';
import type {Location} from 'history';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
} from 'sentry/components/charts/styles';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import {EAPChartsWidget} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';
import {TransactionsListOption} from 'sentry/views/releases/detail/overview';

import {
  TrendFunctionField,
  TrendParameterColumn,
  TrendParameterLabel,
} from '../../trends/types';
import {TRENDS_FUNCTIONS, TRENDS_PARAMETERS} from '../../trends/utils';
import {SpanOperationBreakdownFilter} from '../filter';

import LatencyChartControls from './latencyChart/chartControls';
import {ZOOM_END, ZOOM_START} from './latencyChart/utils';
import DurationChart from './durationChart';
import DurationPercentileChart from './durationPercentileChart';
import LatencyChart from './latencyChart';
import TrendChart from './trendChart';
import UserMiseryChart from './userMiseryChart';
import VitalsChart from './vitalsChart';

function generateDisplayOptions(
  currentFilter: SpanOperationBreakdownFilter
): Array<SelectValue<string>> {
  if (currentFilter === SpanOperationBreakdownFilter.NONE) {
    return [
      {value: DisplayModes.DURATION, label: t('Duration Breakdown')},
      {value: DisplayModes.DURATION_PERCENTILE, label: t('Duration Percentiles')},
      {value: DisplayModes.LATENCY, label: t('Duration Distribution')},
      {value: DisplayModes.TREND, label: t('Trends')},
      {value: DisplayModes.VITALS, label: t('Web Vitals')},
      {value: DisplayModes.USER_MISERY, label: t('User Misery')},
    ];
  }

  // A span operation name breakdown has been chosen.

  return [
    {value: DisplayModes.DURATION, label: t('Span Operation Breakdown')},
    {value: DisplayModes.DURATION_PERCENTILE, label: t('Span Operation Percentiles')},
    {value: DisplayModes.LATENCY, label: t('Span Operation Distribution')},
    {value: DisplayModes.TREND, label: t('Trends')},
    {value: DisplayModes.VITALS, label: t('Web Vitals')},
  ];
}

const TREND_FUNCTIONS_OPTIONS: Array<SelectValue<string>> = TRENDS_FUNCTIONS.map(
  ({field, label}) => ({
    value: field,
    label,
  })
);

type Props = {
  currentFilter: SpanOperationBreakdownFilter;
  eventView: EventView;
  location: Location;
  organization: Organization;
  totalValue: number | null;
  withoutZerofill: boolean;
  project?: Project;
};

function TransactionSummaryCharts({
  totalValue,
  eventView,
  organization,
  location,
  currentFilter,
  withoutZerofill,
  project,
}: Props) {
  const navigate = useNavigate();

  function handleDisplayChange(value: string) {
    const display = decodeScalar(location.query.display, DisplayModes.DURATION);
    trackAnalytics('performance_views.transaction_summary.change_chart_display', {
      organization,
      from_chart: display,
      to_chart: value,
    });

    navigate({
      pathname: location.pathname,
      query: {
        ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
        display: value,
      },
    });
  }

  function handleTrendDisplayChange(value: string) {
    navigate({
      pathname: location.pathname,
      query: {...location.query, trendFunction: value},
    });
  }

  function handleTrendColumnChange(value: string) {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        trendParameter: value,
      },
    });
  }

  const TREND_PARAMETERS_OPTIONS: Array<SelectValue<string>> = TRENDS_PARAMETERS.map(
    ({label}) => ({
      value: label,
      label,
    })
  );

  let display = decodeScalar(location.query.display, DisplayModes.DURATION);
  let trendFunction = decodeScalar(
    location.query.trendFunction,
    TREND_FUNCTIONS_OPTIONS[0]!.value
  ) as TrendFunctionField;
  let trendParameter = decodeScalar(
    location.query.trendParameter,
    TREND_PARAMETERS_OPTIONS[0]!.value
  );

  if (!Object.values(DisplayModes).includes(display as DisplayModes)) {
    display = DisplayModes.DURATION;
  }
  if (!Object.values(TrendFunctionField).includes(trendFunction)) {
    trendFunction = TrendFunctionField.P50;
  }
  if (
    !Object.values(TrendParameterLabel).includes(trendParameter as TrendParameterLabel)
  ) {
    trendParameter = TrendParameterLabel.DURATION;
  }

  const trendColumn =
    TRENDS_PARAMETERS.find(parameter => parameter.label === trendParameter)?.column ||
    TrendParameterColumn.DURATION;

  const releaseQueryExtra = {
    yAxis: display === DisplayModes.VITALS ? 'countVital' : 'countDuration',
    showTransactions:
      display === DisplayModes.VITALS
        ? TransactionsListOption.SLOW_LCP
        : display === DisplayModes.DURATION
          ? TransactionsListOption.SLOW
          : undefined,
  };

  const mepSetting = useMEPSettingContext();
  const mepCardinalityContext = useMetricsCardinalityContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    mepCardinalityContext,
    organization
  );

  const hasTransactionSummaryCleanupFlag = organization.features.includes(
    'performance-transaction-summary-cleanup'
  );

  const displayOptions = generateDisplayOptions(currentFilter).filter(
    option =>
      (hasTransactionSummaryCleanupFlag && option.value !== DisplayModes.USER_MISERY) ||
      !hasTransactionSummaryCleanupFlag
  );

  return (
    <Panel>
      <EAPChartsWidget />
      <ChartContainer data-test-id="transaction-summary-charts">
        {display === DisplayModes.LATENCY && (
          <LatencyChart
            organization={organization}
            location={location}
            query={eventView.query}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            currentFilter={currentFilter}
            totalCount={totalValue}
          />
        )}
        {display === DisplayModes.DURATION && (
          <DurationChart
            organization={organization}
            query={eventView.query}
            queryExtra={releaseQueryExtra}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            currentFilter={currentFilter}
            withoutZerofill={withoutZerofill}
            queryExtras={queryExtras}
          />
        )}
        {display === DisplayModes.DURATION_PERCENTILE && (
          <DurationPercentileChart
            organization={organization}
            location={location}
            query={eventView.query}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            currentFilter={currentFilter}
            queryExtras={queryExtras}
          />
        )}
        {display === DisplayModes.TREND && (
          <TrendChart
            eventView={eventView}
            trendFunction={trendFunction}
            trendParameter={trendColumn}
            organization={organization}
            query={eventView.query}
            queryExtra={releaseQueryExtra}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            withoutZerofill={withoutZerofill}
            projects={project ? [project] : []}
            withBreakpoint={organization.features.includes('performance-new-trends')}
          />
        )}
        {display === DisplayModes.VITALS && (
          <VitalsChart
            organization={organization}
            query={eventView.query}
            queryExtra={releaseQueryExtra}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            withoutZerofill={withoutZerofill}
            queryExtras={queryExtras}
          />
        )}
        {display === DisplayModes.USER_MISERY && (
          <UserMiseryChart
            organization={organization}
            query={eventView.query}
            queryExtra={releaseQueryExtra}
            project={eventView.project}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            withoutZerofill={withoutZerofill}
          />
        )}
      </ChartContainer>

      <ReversedChartControls>
        <InlineContainer>
          {display === DisplayModes.TREND && (
            <OptionSelector
              title={t('Percentile')}
              selected={trendFunction}
              options={TREND_FUNCTIONS_OPTIONS}
              onChange={handleTrendDisplayChange}
            />
          )}
          {display === DisplayModes.TREND && (
            <OptionSelector
              title={t('Parameter')}
              selected={trendParameter}
              options={TREND_PARAMETERS_OPTIONS}
              onChange={handleTrendColumnChange}
            />
          )}
          {display === DisplayModes.LATENCY && (
            <LatencyChartControls location={location} />
          )}
          <OptionSelector
            title={t('Display')}
            selected={display}
            options={displayOptions}
            onChange={handleDisplayChange}
          />
        </InlineContainer>
      </ReversedChartControls>
    </Panel>
  );
}

const ReversedChartControls = styled(ChartControls)`
  flex-direction: row-reverse;
`;

export default TransactionSummaryCharts;
