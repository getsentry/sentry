import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
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
import {TreemapDiffSection} from 'sentry/views/preprod/buildComparison/main/treemapDiffSection';

type SectionProps = MetricIds & {project: Project};

function EventXrayDiffContent({baseMetricId, headMetricId, project}: SectionProps) {
  const query = useSizeAnalysisComparison({baseMetricId, headMetricId, project});

  if (query.isLoading) {
    return <LoadingIndicator />;
  }

  if (query.isError) {
    return (
      <LoadingError
        message={t('Failed to load X-Ray diff data.')}
        onRetry={query.refetch}
      />
    );
  }

  const diffItems = query.data?.diff_items;

  if (!diffItems || diffItems.length === 0) {
    return <EmptyStateWarning small>{t('No diff found.')}</EmptyStateWarning>;
  }

  return <TreemapDiffSection diffItems={diffItems} />;
}

function EventXrayDiffSection({baseMetricId, headMetricId, project}: SectionProps) {
  return (
    <InterimSection title={t('X-Ray diff')} type={SectionKey.XRAY_DIFF}>
      <ErrorBoundary mini>
        <EventXrayDiffContent
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

function EventXrayDiff(props: Props) {
  const ids = getMetricIds(props.event);
  if (ids) {
    return <EventXrayDiffSection {...props} {...ids} />;
  }
  return null;
}

export {EventXrayDiff};
