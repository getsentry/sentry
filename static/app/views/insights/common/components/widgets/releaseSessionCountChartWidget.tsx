import {t} from 'sentry/locale';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useReleaseSessionCounts from 'sentry/views/insights/sessions/queries/useReleaseSessionCounts';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function ReleaseSessionCountChartwidget(props: LoadableChartWidgetProps) {
  const {series, releases, isPending, error} = useReleaseSessionCounts({
    pageFilters: props.pageFilters,
  });

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_total_sessions`, formatVersion(release)]) ?? []
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="releaseSessionCountChartWidget"
      title={CHART_TITLES.ReleaseSessionCountChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ReleaseSessionCountChartWidget} />
      )}
      height={props.height || SESSION_HEALTH_CHART_HEIGHT}
      description={t(
        'The total number of sessions per release. The 5 most recent releases are shown.'
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
