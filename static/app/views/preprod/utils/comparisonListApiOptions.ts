import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface SizeAnalysisComparisonsResponse {
  comparisons: BuildDetailsApiResponse[];
}

export function comparisonListApiOptions({
  organization,
  headArtifactId,
  query,
}: {
  headArtifactId: string;
  organization: Organization;
  query?: string;
}) {
  return apiOptions.as<SizeAnalysisComparisonsResponse>()(
    '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/size-analysis/comparisons/',
    {
      path: {organizationIdOrSlug: organization.slug, headArtifactId},
      query: query ? {query} : {},
      staleTime: 0,
    }
  );
}
