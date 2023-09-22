import hydrateFeedbackRecord from 'sentry/components/bugReports/hydrateFeedbackRecord';
import {Organization, Project} from 'sentry/types';
import {FeedbackItemResponse} from 'sentry/utils/feedback/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
  project: Project;
}

export default function useFetchFeedbackItem(
  {feedbackId, organization, project}: Props,
  options: undefined | Partial<UseApiQueryOptions<FeedbackItemResponse>> = {}
) {
  const {data, isError, isLoading} = useApiQuery<FeedbackItemResponse>(
    [`/projects/${organization.slug}/${project.slug}/feedback/${feedbackId}/`],
    {staleTime: 0, ...options}
  );

  return {
    data: data ? hydrateFeedbackRecord(data) : undefined,
    isError,
    isLoading,
  };
}
