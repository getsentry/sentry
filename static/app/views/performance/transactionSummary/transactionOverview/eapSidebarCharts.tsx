import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {usePrebuiltDashboardUrl} from 'sentry/views/dashboards/utils/usePrebuiltDashboardUrl';
import {WidgetCardDataLoader} from 'sentry/views/dashboards/widgetCard/widgetCardDataLoader';
import {SCORE_BREAKDOWN_WHEEL_WIDGET} from 'sentry/views/dashboards/widgetLibrary/webVitalsWidgets';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {WheelWidgetVisualization} from 'sentry/views/dashboards/widgets/wheelWidget/wheelWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';

const REFERRER = 'eap-sidebar-charts';

type Props = {
  hasWebVitals: boolean;
  transactionName: string;
};

export function EAPSidebarCharts({transactionName, hasWebVitals}: Props) {
  return (
    <Stack gap="md">
      {hasWebVitals && <WebVitalsWidget transactionName={transactionName} />}
      <FailureRateWidget transactionName={transactionName} />
    </Stack>
  );
}

function WebVitalsWidget({transactionName}: {transactionName: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );

  const filterValue = useMemo(() => {
    const search = new MutableSearch('');
    search.addFilterValue(SpanFields.TRANSACTION, transactionName);
    return search.formatString();
  }, [transactionName]);

  const dashboardUrl = usePrebuiltDashboardUrl(PrebuiltDashboardId.WEB_VITALS_SUMMARY, {
    filters: {
      globalFilter: [
        {
          dataset: WidgetType.SPANS,
          tag: {
            key: SpanFields.TRANSACTION,
            name: SpanFields.TRANSACTION,
            kind: FieldKind.TAG,
          },
          value: filterValue,
        },
      ],
    },
  });

  const widget = useMemo(() => {
    const conditions = new MutableSearch(
      SCORE_BREAKDOWN_WHEEL_WIDGET.queries[0]!.conditions
    );
    conditions.addFilterValue('transaction', transactionName);
    return {
      ...SCORE_BREAKDOWN_WHEEL_WIDGET,
      queries: [
        {
          ...SCORE_BREAKDOWN_WHEEL_WIDGET.queries[0]!,
          conditions: conditions.formatString(),
        },
      ],
    };
  }, [transactionName]);

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Performance Score')} />}
      Actions={
        <Widget.WidgetToolbar>
          {hasPrebuiltDashboards && dashboardUrl && (
            <LinkButton to={dashboardUrl} size="sm">
              {t('View Details')}
            </LinkButton>
          )}
        </Widget.WidgetToolbar>
      }
      Visualization={
        <WidgetCardDataLoader widget={widget} selection={selection}>
          {({loading, tableResults, errorMessage}) => {
            if (loading || errorMessage) {
              return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
            }
            return <WheelWidgetVisualization tableResults={tableResults} />;
          }}
        </WidgetCardDataLoader>
      }
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
        Title={<Widget.WidgetTitle title={t('Failure Rate')} />}
        TitleBadges={getFailureRateBadge()}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        borderless
      />
    );
  }

  const plottables = failureRateSeriesData.timeSeries.map(
    ts => new Line(ts, {color: theme.colors.red400})
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Failure Rate')} />}
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
