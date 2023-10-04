import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import {FeedbackListResponse} from 'sentry/utils/feedback/list/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Response = {
  data: HydratedFeedbackItem[] | undefined;
  isError: boolean;
  isLoading: boolean;
  pageLinks: string | string[] | undefined;
};

export default function useFetchFeedbackList(
  params: {query: Record<string, string | string[] | undefined>} = {
    query: {},
  },
  options: undefined | Partial<UseApiQueryOptions<FeedbackListResponse>> = {}
): Response {
  const organization = useOrganization();
  const {data, isError, isLoading, getResponseHeader} = useApiQuery<FeedbackListResponse>(
    [`/organizations/${organization.slug}/feedback/`, params],
    {staleTime: 0, ...options}
  );

  return {
    data: data?.filter(Boolean).map(hydrateFeedbackRecord),
    isError,
    isLoading,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
