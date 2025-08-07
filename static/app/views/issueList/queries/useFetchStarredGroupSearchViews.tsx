import type {ApiQueryKey} from 'sentry/utils/queryClient';

type FetchStarredGroupSearchViewsParameters = {
  orgSlug: string;
};

export const makeFetchStarredGroupSearchViewsKey = ({
  orgSlug,
}: FetchStarredGroupSearchViewsParameters): ApiQueryKey =>
  [`/organizations/${orgSlug}/group-search-views/starred/`, {}] as const;
