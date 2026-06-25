import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export type SizeAnalysisComparisonState = 'success' | 'processing' | 'failed';

export interface SizeAnalysisComparisonListItem {
  base_build_details: BuildDetailsApiResponse;
  date_added: string;
  state: SizeAnalysisComparisonState;
}

export function comparisonListApiOptions({
  organization,
  headArtifactId,
  query,
  cursor,
}: {
  headArtifactId: string;
  organization: Organization;
  cursor?: string;
  query?: string;
}) {
  return apiOptions.as<SizeAnalysisComparisonListItem[]>()(
    '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/size-analysis/comparisons/',
    {
      path: {organizationIdOrSlug: organization.slug, headArtifactId},
      query: {
        ...(query ? {query} : {}),
        ...(cursor ? {cursor} : {}),
      },
      staleTime: 0,
    }
  );
}
