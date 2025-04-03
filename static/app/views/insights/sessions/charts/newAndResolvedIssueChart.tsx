import {t} from 'sentry/locale';
import {InsightsBarChartWidget} from 'sentry/views/insights/common/components/insightsBarChartWidget';
import ChartSelectionTitle from 'sentry/views/insights/sessions/components/chartSelectionTitle';
import useNewAndResolvedIssues from 'sentry/views/insights/sessions/queries/useNewAndResolvedIssues';
import {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export default function NewAndResolvedIssueChart() {
  const {series, isPending, error} = useNewAndResolvedIssues({type: 'issue'});

  const aliases = {
    new_issues_count: 'new_issues',
    resolved_issues_count: 'resolved_issues',
  };

  return (
    <InsightsBarChartWidget
      title={CHART_TITLES.NewAndResolvedIssueChart}
      interactiveTitle={() => (
        <ChartSelectionTitle title={CHART_TITLES.NewAndResolvedIssueChart} />
      )}
      description={t('New and resolved %s counts over time.', type)}
      aliases={aliases}
      series={series}
      isLoading={isPending}
      error={error}
    />
  );
}
