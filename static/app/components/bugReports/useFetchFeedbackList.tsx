import hydrateFeedbackRecord from 'sentry/components/bugReports/hydrateFeedbackRecord';
import {
  FeedbackListQueryParams,
  FeedbackListResponse,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Response = {
  data: HydratedFeedbackItem[] | undefined;
  isError: boolean;
  isLoading: boolean;
  pageLinks: string | undefined;
};

export default function useFetchFeedbackList(
  params: {query: FeedbackListQueryParams} = {
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
    data: data?.map(hydrateFeedbackRecord),
    isError,
    isLoading,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
