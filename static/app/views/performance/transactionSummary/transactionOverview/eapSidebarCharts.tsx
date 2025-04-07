import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useEAPSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
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

  const {
    data: failureRateData,
    isPending: isFailureRatePending,
    isError: isFailureRateError,
  } = useEAPSeries(
    {
      search: new MutableSearch(`transaction:${transactionName}`),
      yAxis: ['failure_rate()'],
    },
    REFERRER
  );

  if (isFailureRatePending || isFailureRateError) {
    return (
      <Widget
        Title={t('Failure Rate')}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  const timeSeries = eapSeriesDataToTimeSeries(failureRateData);
  const plottables = timeSeries.map(series => new Line(series, {color: theme.red300}));
  return (
    <Widget
      Title={t('Failure Rate')}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription
            title={t('Failure Rate')}
            description={getTermHelp(organization, PerformanceTerm.FAILURE_RATE)}
          />
        </Widget.WidgetToolbar>
      }
      Visualization={<TimeSeriesWidgetVisualization plottables={plottables} />}
    />
  );
}
