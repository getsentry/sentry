import {
  queryOptions,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {
  InvestigationCandidate,
  InvestigationDetail,
  InvestigationListItem,
  MetricOpenPeriodInvestigationSource,
} from 'sentry/views/investigations/types';

type ListOptions = {
  organizationSlug: string;
  cursor?: string;
  query?: string;
};

export function investigationListQueryOptions({
  organizationSlug,
  cursor,
  query,
}: ListOptions) {
  return apiOptions.as<InvestigationListItem[]>()(
    '/organizations/$organizationIdOrSlug/investigations/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {status: 'active', cursor, query},
      staleTime: 0,
    }
  );
}

export function investigationDetailQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationDetail>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        investigationId,
      },
      staleTime: 30_000,
    }
  );
}

export function investigationCandidatesQueryOptions({
  organizationSlug,
  sources,
}: {
  organizationSlug: string;
  sources: MetricOpenPeriodInvestigationSource[];
}) {
  return queryOptions({
    queryKey: ['investigation-candidates', organizationSlug, sources] as const,
    queryFn: () =>
      fetchMutation<{items: InvestigationCandidate[]}>({
        url: `/organizations/${organizationSlug}/investigations/candidates/`,
        method: 'POST',
        data: {
          templateKey: 'breached_metric',
          templateVersion: 1,
          sources,
        },
      }),
    staleTime: 30_000,
  });
}

type FavoriteVariables = {
  investigation: InvestigationListItem;
  shouldFavorite: boolean;
};

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  'mutationFn'
>;

function useInvestigationMutation<TData, TVariables>(
  organizationSlug: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: MutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({organizationSlug}).queryKey,
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationListItem, void>
) {
  return useInvestigationMutation(
    organizationSlug,
    () =>
      fetchMutation<InvestigationListItem>({
        url: `/organizations/${organizationSlug}/investigations/`,
        method: 'POST',
        data: {title: 'Untitled investigation'},
      }),
    options
  );
}

export function useLaunchInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationDetail, MetricOpenPeriodInvestigationSource>
) {
  return useInvestigationMutation(
    organizationSlug,
    source =>
      fetchMutation<InvestigationDetail>({
        url: `/organizations/${organizationSlug}/investigations/`,
        method: 'POST',
        data: {
          templateKey: 'breached_metric',
          templateVersion: 1,
          source,
        },
      }),
    options
  );
}

export function useSetInvestigationFavoriteMutation(
  organizationSlug: string,
  options?: MutationOptions<void, FavoriteVariables>
) {
  return useInvestigationMutation(
    organizationSlug,
    ({investigation, shouldFavorite}: FavoriteVariables) =>
      fetchMutation<void>({
        url: `/organizations/${organizationSlug}/investigations/${investigation.id}/favorite/`,
        method: 'PUT',
        data: {shouldFavorite},
      }),
    options
  );
}

export function useDuplicateInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationListItem, InvestigationListItem>
) {
  return useInvestigationMutation(
    organizationSlug,
    investigation =>
      fetchMutation<InvestigationListItem>({
        url: `/organizations/${organizationSlug}/investigations/${investigation.id}/duplicate/`,
        method: 'POST',
      }),
    options
  );
}

export function useDeleteInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<void, InvestigationListItem>
) {
  return useInvestigationMutation(
    organizationSlug,
    investigation =>
      fetchMutation<void>({
        url: `/organizations/${organizationSlug}/investigations/${investigation.id}/`,
        method: 'DELETE',
        data: {investigationVersion: investigation.version},
      }),
    options
  );
}
