import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SizeAnalysisComparisonResults} from 'sentry/views/preprod/types/appSizeTypes';

export interface MetricIds {
  baseMetricId: string;
  headMetricId: string;
}

export function getMetricIds(event: Event): MetricIds | undefined {
  const headMetricId = event.occurrence?.evidenceData?.headSizeMetricId;
  const baseMetricId = event.occurrence?.evidenceData?.baseSizeMetricId;

  if (baseMetricId && headMetricId) {
    return {baseMetricId, headMetricId};
  }
  return undefined;
}

export function useSizeAnalysisComparison({
  baseMetricId,
  headMetricId,
  project,
}: MetricIds & {
  project: Project;
}) {
  const organization = useOrganization();

  return useApiQuery<SizeAnalysisComparisonResults>(
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
}
