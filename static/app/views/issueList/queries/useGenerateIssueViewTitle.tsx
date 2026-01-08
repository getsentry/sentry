import {useMutation, type UseMutationOptions} from '@tanstack/react-query';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface GenerateIssueViewTitleResponse {
  title: string;
}

interface GenerateIssueViewTitleData {
  query: string;
}

export function useGenerateIssueViewTitle(
  options?: UseMutationOptions<
    GenerateIssueViewTitleResponse,
    Error,
    GenerateIssueViewTitleData
  >
) {
  const api = useApi();
  const organization = useOrganization();

  return useMutation({
    mutationFn: (data: GenerateIssueViewTitleData) =>
      api.requestPromise(
        `/organizations/${organization.slug}/issue-view-title/generate/`,
        {
          method: 'POST',
          data,
        }
      ),
    ...options,
  });
}
