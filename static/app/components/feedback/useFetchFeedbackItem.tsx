import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {Organization, Project} from 'sentry/types';
import {FeedbackItemResponse} from 'sentry/utils/feedback/item/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
  project: undefined | Project;
}

export default function useFetchFeedbackItem(
  {feedbackId, organization, project}: Props,
  options: undefined | Partial<UseApiQueryOptions<FeedbackItemResponse>> = {}
) {
  const {data, ...result} = useApiQuery<FeedbackItemResponse>(
    [`/projects/${organization.slug}/${project?.slug}/feedback/${feedbackId}/`],
    {staleTime: 0, enabled: Boolean(project), ...options}
  );

  return {
    data: data ? hydrateFeedbackRecord(data) : undefined,
    ...result,
  };
}
