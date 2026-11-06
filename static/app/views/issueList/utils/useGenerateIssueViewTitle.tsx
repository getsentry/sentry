import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

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
  return useQuery({
    ...apiOptions.as<GenerateIssueViewTitleResponse>()(
      '/organizations/$organizationIdOrSlug/issue-view-title/generate/',
      {
        path: {organizationIdOrSlug: organization.slug},
        method: 'POST',
        data: {query},
        staleTime: 5 * 60 * 1000,
      }
    ),
    enabled: !organization.hideAiFeatures && enabled && !!query,
    retry: false,
  });
}
