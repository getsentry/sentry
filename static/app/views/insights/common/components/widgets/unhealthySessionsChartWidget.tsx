import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useErroredSessions from 'sentry/views/insights/sessions/queries/useErroredSessions';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function UnhealthySessionsChartWidget(props: LoadableChartWidgetProps) {
  const {series, isPending, error} = useErroredSessions({
    pageFilters: props.pageFilters,
  });

  const aliases = {
    successful_session_rate: t('error_rate(sessions)'),
  };

  return (
    <InsightsLineChartWidget
      {...props}
      id="unhealthySessionsChartWidget"
      title={CHART_TITLES.UnhealthySessionsChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.UnhealthySessionsChartWidget} />
      )}
      height={props.height || SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions ending normally, with no errors occurring during its lifetime. See [link:session status].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/releases/health/#session-status" />
          ),
        }
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
