import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TreemapDiffSection} from 'sentry/views/preprod/buildComparison/main/treemapDiffSection';
import type {SizeAnalysisComparisonResults} from 'sentry/views/preprod/types/appSizeTypes';

type ContentProps = {
  baseMetricId: string;
  headMetricId: string;
  project: Project;
};

function EventXrayDiffContent({baseMetricId, headMetricId, project}: ContentProps) {
  const organization = useOrganization();

  const query = useApiQuery<SizeAnalysisComparisonResults>(
    [
      `/projects/${organization.slug}/${project.id}/preprodartifacts/size-analysis/compare/${headMetricId}/${baseMetricId}/download/`,
    ],
    {
      staleTime: 0,
    }
  );

  if (query.isLoading) {
    return <LoadingIndicator />;
  }

  const diffItems = query.data?.diff_items;

  if (!diffItems || diffItems.length === 0) {
    return <EmptyStateWarning small>No diff found.</EmptyStateWarning>;
  }

  return <TreemapDiffSection diffItems={diffItems} />;
}

type SectionProps = {
  baseMetricId: string;
  headMetricId: string;
  project: Project;
};

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

interface MetricIds {
  baseMetricId: string;
  headMetricId: string;
}

function getMetricIds(event: Event): MetricIds | undefined {
  const headMetricId = event.occurrence?.evidenceData?.headSizeMetricId;
  const baseMetricId = event.occurrence?.evidenceData?.baseSizeMetricId;

  if (baseMetricId && headMetricId) {
    return {
      baseMetricId,
      headMetricId,
    };
  }
  return undefined;
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
