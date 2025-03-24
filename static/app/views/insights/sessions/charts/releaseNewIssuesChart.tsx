import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useReleaseNewIssues from 'sentry/views/insights/sessions/queries/useReleaseNewIssues';

export default function ReleaseNewIssuesChart() {
  const {series, isPending, error} = useReleaseNewIssues();

  return (
    <InsightsLineChartWidget
      title={t('Issues per Release')}
      description={t('New issue counts over time, grouped by release.')}
      series={series}
      isLoading={isPending}
      legendSelection={{
        // disable the 'other' series by default since its large values can cause the other lines to be insignificant
        ['other']: false,
      }}
      error={error}
    />
  );
}
