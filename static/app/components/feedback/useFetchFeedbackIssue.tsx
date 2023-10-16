import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {Organization} from 'sentry/types';
import {RawFeedbackItemResponse} from 'sentry/utils/feedback/item/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
}

export default function useFetchFeedbackIssue(
  {feedbackId, organization}: Props,
  options: undefined | Partial<UseApiQueryOptions<RawFeedbackItemResponse>> = {}
) {
  const {data, ...result} = useApiQuery<RawFeedbackItemResponse>(
    [
      `/organizations/${organization.slug}/issues/${feedbackId}/`,
      {
        query: {
          collapse: ['release', 'tags'],
          expand: ['inbox', 'owners'],
        },
      },
    ],
    {
      staleTime: 0,
      ...options,
    }
  );

  return {
    data: data ? hydrateFeedbackRecord(data) : undefined,
    ...result,
  };
}
