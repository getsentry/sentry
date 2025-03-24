import {t} from 'sentry/locale';
import {InsightsBarChartWidget} from 'sentry/views/insights/common/components/insightsBarChartWidget';
import useNewAndResolvedIssues from 'sentry/views/insights/sessions/queries/useNewAndResolvedIssues';

export default function NewAndResolvedIssueChart({type}: {type: 'issue' | 'feedback'}) {
  const {series, isPending, error} = useNewAndResolvedIssues({type});

  const aliases = {
    new_issues_count: `new_${type}s`,
    resolved_issues_count: `resolved_${type}s`,
  };

  return (
    <InsightsBarChartWidget
      title={type === 'issue' ? t('Issues') : t('User Feedback')}
      description={t('New and resolved %s counts over time.', type)}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
