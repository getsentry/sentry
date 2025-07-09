import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useCrashFreeSessions from 'sentry/views/insights/sessions/queries/useCrashFreeSessions';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function CrashFreeSessionsChartWidget(props: LoadableChartWidgetProps) {
  const {series, releases, isPending, error} = useCrashFreeSessions({
    pageFilters: props.pageFilters,
  });

  const aliases = Object.fromEntries(
    releases?.map(release => [
      `crash_free_session_rate_${release}`,
      formatVersion(release),
    ]) ?? []
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="crashFreeSessionsChartWidget"
      title={CHART_TITLES.CrashFreeSessionsChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.CrashFreeSessionsChartWidget} />
      )}
      height={props.height || SESSION_HEALTH_CHART_HEIGHT}
      description={tct(
        'The percent of sessions terminating without a crash. See [link:session status]. The 5 most adopted releases are shown.',
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
