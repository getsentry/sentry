import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface GenerateIssueViewTitleResponse {
  title: string;
}

interface GenerateIssueViewTitleData {
  query: string;
}

export function useGenerateIssueViewTitle() {
  const organization = useOrganization();

  return useMutation<
    GenerateIssueViewTitleResponse,
    RequestError,
    GenerateIssueViewTitleData
  >({
    mutationFn: ({query}: GenerateIssueViewTitleData) => {
      return fetchMutation<GenerateIssueViewTitleResponse>({
        url: `/organizations/${organization.slug}/issue-view-title/generate/`,
        method: 'POST',
        data: {query},
      });
    },
  });
}
