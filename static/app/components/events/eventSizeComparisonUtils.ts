import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SizeAnalysisComparisonResults} from 'sentry/views/preprod/types/appSizeTypes';

const SIZE_ANALYSIS_COMPARISON_DOWNLOAD_ENDPOINT =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/size-analysis/compare/$headSizeMetricId/$baseSizeMetricId/download/';

export type EventSizeComparisonSectionProps = {
  baseMetricId: string;
  headMetricId: string;
  project: Project;
};

export type EventSizeMetricIds = Pick<
  EventSizeComparisonSectionProps,
  'baseMetricId' | 'headMetricId'
>;

export function getEventSizeMetricIds(event: Event): EventSizeMetricIds | undefined {
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

export function useEventSizeComparisonQuery({
  baseMetricId,
  headMetricId,
  project,
}: EventSizeComparisonSectionProps) {
  const organization = useOrganization();

  return useApiQuery<SizeAnalysisComparisonResults>(
    [
      getApiUrl(SIZE_ANALYSIS_COMPARISON_DOWNLOAD_ENDPOINT, {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.id,
          headSizeMetricId: headMetricId,
          baseSizeMetricId: baseMetricId,
        },
      }),
    ],
    {
      staleTime: 0,
    }
  );
}
