import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import useReleaseNewIssues from 'sentry/views/insights/sessions/queries/useReleaseNewIssues';

export default function ReleaseNewIssuesChart({type}: {type: 'issue' | 'feedback'}) {
  const {series, isPending, error} = useReleaseNewIssues({type});

  return (
    <InsightsLineChartWidget
      title={type === 'issue' ? t('Issues per Release') : t('User Feedback per Release')}
      description={t('New %s counts over time, grouped by release.', type)}
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
