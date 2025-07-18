import {t} from 'sentry/locale';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useReleaseSessionPercentage from 'sentry/views/insights/sessions/queries/useReleaseSessionPercentage';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

export default function ReleaseSessionPercentageChartWidget(
  props: LoadableChartWidgetProps
) {
  const {series, releases, isPending, error} = useReleaseSessionPercentage({
    pageFilters: props.pageFilters,
  });

  const aliases = Object.fromEntries(
    releases?.map(release => [`${release}_session_percent`, formatVersion(release)]) ?? []
  );

  return (
    <InsightsAreaChartWidget
      {...props}
      id="releaseSessionPercentageChartWidget"
      title={CHART_TITLES.ReleaseSessionPercentageChartWidget}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.ReleaseSessionPercentageChartWidget} />
      )}
      height={props.height || SESSION_HEALTH_CHART_HEIGHT}
      description={t(
        'The percentage of total sessions that each release accounted for. The 5 most recent releases are shown.'
      )}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
