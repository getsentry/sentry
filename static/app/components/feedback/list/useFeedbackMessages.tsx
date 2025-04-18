import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';

const FEEDBACK_STALE_TIME = 10 * 60 * 1000;

export default function useFeedbackMessages() {
  const organization = useOrganization();
  const queryView = useLocationQuery({
    fields: {
      limit: 10,
      queryReferrer: 'feedback_list_page',
      project: decodeList,
      statsPeriod: '7d',
    },
  });

  const {data, isPending, isError} = useApiQuery<FeedbackIssue[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          ...queryView,
          query: `issue.category:feedback status:unresolved`,
        },
      },
    ],
    {staleTime: FEEDBACK_STALE_TIME}
  );

  if (isPending || isError) {
    return [];
  }

  return data.map(feedback => {
    return feedback.metadata.message;
  });
}
