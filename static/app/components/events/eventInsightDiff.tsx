import {Text} from '@sentry/scraps/text';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {InsightComparisonSection} from 'sentry/views/preprod/buildComparison/main/insightComparisonSection';
import type {SizeAnalysisComparisonResults} from 'sentry/views/preprod/types/appSizeTypes';

type ContentProps = SectionProps;

function EventInsightDiffContent({baseMetricId, headMetricId, project}: ContentProps) {
  const organization = useOrganization();

  const query = useApiQuery<SizeAnalysisComparisonResults>(
    [
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/size-analysis/compare/$headSizeMetricId/$baseSizeMetricId/download/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.id,
            headSizeMetricId: headMetricId,
            baseSizeMetricId: baseMetricId,
          },
        }
      ),
    ],
    {
      staleTime: 0,
    }
  );

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

type SectionProps = {
  baseMetricId: string;
  headMetricId: string;
  project: Project;
};

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

function EventInsightDiff(props: Props) {
  const ids = getMetricIds(props.event);
  if (ids) {
    return <EventInsightDiffSection {...props} {...ids} />;
  }
  return null;
}

export {EventInsightDiff};
