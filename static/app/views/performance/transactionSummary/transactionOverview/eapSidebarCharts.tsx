import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

type Props = {
  hasWebVitals: boolean;
  transactionName: string;
};

const REFERRER = 'eap-sidebar-charts';

export function EAPSidebarCharts({transactionName, hasWebVitals}: Props) {
  return (
    <Stack gap="md">
      {hasWebVitals && <Widget Title={t('Web Vitals')} />}
      <ApdexWidget transactionName={transactionName} />
      <FailureRateWidget transactionName={transactionName} />
    </Stack>
  );
}

type ApdexWidgetProps = {
  transactionName: string;
};

function ApdexWidget({transactionName}: ApdexWidgetProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();
  const {transactionThreshold, transactionThresholdMetric} =
    useTransactionSummaryContext();

  const threshold = transactionThreshold ?? 300;
  const apdexDurationField =
    transactionThresholdMetric === TransactionThresholdMetric.LARGEST_CONTENTFUL_PAINT
      ? 'measurements.lcp'
      : 'span.duration';
  const apdexField = `apdex(${apdexDurationField},${threshold})` as const;

  const transactionSearch = new MutableSearch('');
  transactionSearch.addFilterValue('transaction', transactionName);

  const {
    data: apdexSeriesData,
    isPending: isApdexSeriesPending,
    isError: isApdexSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: transactionSearch.copy(),
      yAxis: [apdexField],
    },
    REFERRER
  );

  const {
    data: apdexValue,
    isPending: isApdexValuePending,
    isError: isApdexValueError,
  } = useSpans(
    {
      search: transactionSearch.copy(),
      fields: [apdexField],
      pageFilters: selection,
    },
    REFERRER
  );

  const getApdexBadge = () => {
    if (isApdexValuePending || isApdexValueError) {
      return null;
    }

    return (
      <Tag key="apdex-value" variant="info">
        {formatFloat(Number(apdexValue[0]?.[apdexField] ?? 0), 4)}
      </Tag>
    );
  };

  if (isApdexSeriesPending || isApdexSeriesError) {
    return (
      <Widget
        Title={t('Apdex')}
        TitleBadges={getApdexBadge()}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  const plottables = apdexSeriesData.timeSeries.map(
    ts => new Line(ts, {color: theme.chart.getColorPalette(1)[0]})
  );

  return (
    <Widget
      Title={<SideBarWidgetTitle>{t('Apdex')}</SideBarWidgetTitle>}
      TitleBadges={getApdexBadge()}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription
            title={t('Apdex')}
            description={getTermHelp(organization, PerformanceTerm.APDEX)}
          />
        </Widget.WidgetToolbar>
      }
      Visualization={
        <TimeSeriesWidgetVisualization plottables={plottables} axisRange="dataMin" />
      }
      height={200}
      borderless
    />
  );
}

type FailureRateWidgetProps = {
  transactionName: string;
};

function FailureRateWidget({transactionName}: FailureRateWidgetProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();

  const transactionSearch = new MutableSearch('');
  transactionSearch.addFilterValue('transaction', transactionName);
  transactionSearch.addFilterValue('is_transaction', 'true');

  const {
    data: failureRateSeriesData,
    isPending: isFailureRateSeriesPending,
    isError: isFailureRateSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: transactionSearch.copy(),
      yAxis: ['failure_rate()'],
    },
    REFERRER
  );

  const {
    data: failureRateValue,
    isPending: isFailureRateValuePending,
    isError: isFailureRateValueError,
  } = useSpans(
    {
      search: transactionSearch.copy(),
      fields: ['failure_rate()'],
      pageFilters: selection,
    },
    REFERRER
  );

  const getFailureRateBadge = () => {
    if (isFailureRateValuePending || isFailureRateValueError) {
      return null;
    }

    return (
      <Tag key="failure-rate-value" variant="danger">
        {formatPercentage(failureRateValue[0]?.['failure_rate()'] ?? 0)}
      </Tag>
    );
  };

  if (isFailureRateSeriesPending || isFailureRateSeriesError) {
    return (
      <Widget
        Title={t('Failure Rate')}
        TitleBadges={getFailureRateBadge()}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  const plottables = failureRateSeriesData.timeSeries.map(
    ts => new Line(ts, {color: theme.colors.red400})
  );

  return (
    <Widget
      Title={<SideBarWidgetTitle>{t('Failure Rate')}</SideBarWidgetTitle>}
      TitleBadges={getFailureRateBadge()}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription
            title={t('Failure Rate')}
            description={getTermHelp(organization, PerformanceTerm.FAILURE_RATE)}
          />
        </Widget.WidgetToolbar>
      }
      Visualization={<TimeSeriesWidgetVisualization plottables={plottables} />}
      height={200}
      borderless
    />
  );
}

const SideBarWidgetTitle = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
