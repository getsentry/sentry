import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface GenerateIssueViewTitleParams {
  query: string;
  enabled?: boolean;
}

interface GenerateIssueViewTitleResponse {
  title: string;
}

export function useGenerateIssueViewTitle({
  query,
  enabled = true,
}: GenerateIssueViewTitleParams) {
  const organization = useOrganization();
  const hasGenerateIssueViewTitleFeature =
    !organization.hideAiFeatures && organization.features.includes('issue-view-ai-title');
  return useApiQuery<GenerateIssueViewTitleResponse>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/issue-view-title/generate/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        method: 'POST',
        data: {query},
      },
    ],
    {
      staleTime: 5 * 60 * 1000,
      enabled: hasGenerateIssueViewTitleFeature && enabled && !!query,
      retry: false,
    }
  );
}
