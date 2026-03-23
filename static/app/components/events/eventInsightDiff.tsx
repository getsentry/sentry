import {Text} from '@sentry/scraps/text';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {
  getMetricIds,
  type MetricIds,
  useSizeAnalysisComparison,
} from 'sentry/utils/preprod/useSizeAnalysisComparison';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {InsightComparisonSection} from 'sentry/views/preprod/buildComparison/main/insightComparisonSection';

type SectionProps = MetricIds & {project: Project};

function EventInsightDiffContent({baseMetricId, headMetricId, project}: SectionProps) {
  const query = useSizeAnalysisComparison({baseMetricId, headMetricId, project});

  if (query.isLoading) {
    return <LoadingIndicator />;
  }

  if (query.isError) {
    return (
      <LoadingError
        message={t('Failed to load insight diff data.')}
        onRetry={query.refetch}
      />
    );
  }

  const insightDiffItems = query.data?.insight_diff_items;
  const totalInstallSizeBytes = query.data?.size_metric_diff_item.head_install_size ?? 0;

  if (!insightDiffItems || insightDiffItems.length === 0) {
    return <Text>{t('No insight diff for comparison')}</Text>;
  }

  return (
    <InsightComparisonSection
      insightDiffItems={insightDiffItems}
      totalInstallSizeBytes={totalInstallSizeBytes}
    />
  );
}

function EventInsightDiffSection({baseMetricId, headMetricId, project}: SectionProps) {
  return (
    <InterimSection title={t('Insight Diff')} type={SectionKey.INSIGHT_DIFF}>
      <ErrorBoundary mini>
        <EventInsightDiffContent
          project={project}
          headMetricId={headMetricId}
          baseMetricId={baseMetricId}
        />
      </ErrorBoundary>
    </InterimSection>
  );
}

type Props = {
  event: Event;
  project: Project;
};

function EventInsightDiff(props: Props) {
  const ids = getMetricIds(props.event);
  if (ids) {
    return <EventInsightDiffSection {...props} {...ids} />;
  }
  return null;
}

export {EventInsightDiff};
