import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {eapSeriesDataToTimeSeries} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

type Props = {
  hasWebVitals: boolean;
  transactionName: string;
};

const REFERRER = 'eap-sidebar-charts';

export function EAPSidebarCharts({transactionName, hasWebVitals}: Props) {
  return (
    <ChartContainer>
      {hasWebVitals && <Widget Title={t('Web Vitals')} />}
      <FailureRateWidget transactionName={transactionName} />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

type FailureRateWidgetProps = {
  transactionName: string;
};

function FailureRateWidget({transactionName}: FailureRateWidgetProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();

  const {
    data: failureRateSeriesData,
    isPending: isFailureRateSeriesPending,
    isError: isFailureRateSeriesError,
  } = useSpanSeries(
    {
      search: new MutableSearch(`transaction:${transactionName}`),
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
      search: new MutableSearch(`transaction:${transactionName}`),
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
      <Tag key="failure-rate-value" type="error">
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

  const timeSeries = eapSeriesDataToTimeSeries(failureRateSeriesData);
  const plottables = timeSeries.map(series => new Line(series, {color: theme.red300}));

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
  font-weight: ${p => p.theme.fontWeight.bold};
`;
