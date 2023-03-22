import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
} from 'sentry/components/charts/styles';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';
import {DisplayModes} from 'sentry/views/performance/transactionSummary/utils';
import {TransactionsListOption} from 'sentry/views/releases/detail/overview';

import {TrendColumnField, TrendFunctionField} from '../../trends/types';
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
): SelectValue<string>[] {
  if (currentFilter === SpanOperationBreakdownFilter.None) {
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

const TREND_FUNCTIONS_OPTIONS: SelectValue<string>[] = TRENDS_FUNCTIONS.map(
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
};

function TransactionSummaryCharts({
  totalValue,
  eventView,
  organization,
  location,
  currentFilter,
  withoutZerofill,
}: Props) {
  function handleDisplayChange(value: string) {
    const display = decodeScalar(location.query.display, DisplayModes.DURATION);
    trackAdvancedAnalyticsEvent(
      'performance_views.transaction_summary.change_chart_display',
      {
        organization,
        from_chart: display,
        to_chart: value,
      }
    );

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
        display: value,
      },
    });
  }

  function handleTrendDisplayChange(value: string) {
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, trendFunction: value},
    });
  }

  function handleTrendColumnChange(value: string) {
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, trendColumn: value},
    });
  }

  const TREND_PARAMETERS_OPTIONS: SelectValue<string>[] = TRENDS_PARAMETERS.map(
    ({column, label}) => ({
      value: column,
      label,
    })
  );

  let display = decodeScalar(location.query.display, DisplayModes.DURATION);
  let trendFunction = decodeScalar(
    location.query.trendFunction,
    TREND_FUNCTIONS_OPTIONS[0].value
  ) as TrendFunctionField;
  let trendColumn = decodeScalar(
    location.query.trendColumn,
    TREND_PARAMETERS_OPTIONS[0].value
  );

  if (!Object.values(DisplayModes).includes(display as DisplayModes)) {
    display = DisplayModes.DURATION;
  }
  if (!Object.values(TrendFunctionField).includes(trendFunction)) {
    trendFunction = TrendFunctionField.P50;
  }
  if (!Object.values(TrendColumnField).includes(trendColumn as TrendColumnField)) {
    trendColumn = TrendColumnField.DURATION;
  }

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
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    organization,
    location
  );

  return (
    <Panel>
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
              selected={trendColumn}
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
            options={generateDisplayOptions(currentFilter)}
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
