import {ExternalLink} from 'sentry/components/core/link';
import {tct} from 'sentry/locale';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useSessionHealthBreakdown from 'sentry/views/insights/sessions/queries/useSessionHealthBreakdown';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function SessionHealthRateChartWidget(props: LoadableChartWidgetProps) {
  const {series, isPending, error} = useSessionHealthBreakdown({
    type: 'rate',
    pageFilters: props.pageFilters,
  });

  const aliases = {
    healthy_session_rate: 'rate_healthy(session)',
    crashed_session_rate: 'rate_crashed(session)',
    errored_session_rate: 'rate_errored(session)',
    abnormal_session_rate: 'rate_abnormal(session)',
  };

  return (
    <InsightsAreaChartWidget
      {...props}
      id="sessionHealthRateChartWidget"
      title={CHART_TITLES.SessionHealthRateChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.SessionHealthRateChartWidget} />
      )}
      height={props.height || SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions with each health status. See [link:session status].',
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
      legendSelection={{
        healthy_session_rate: false,
      }}
    />
  );
}
