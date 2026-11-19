import {useMutation, useQueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {ServiceAccount, ServiceAccountInput} from './types';

export function serviceAccountsApiOptions(
  organization: Organization,
  {cursor}: {cursor?: string} = {}
) {
  return apiOptions.as<ServiceAccount[]>()(
    '/organizations/$organizationIdOrSlug/service-accounts/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {cursor},
      staleTime: 0,
    }
  );
}

export function serviceAccountApiOptions(
  organization: Organization,
  serviceAccountId: string
) {
  return apiOptions.as<ServiceAccount>()(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
    {
      path: {organizationIdOrSlug: organization.slug, serviceAccountId},
      staleTime: 0,
    }
  );
}

export function useCreateServiceAccount(organization: Organization) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceAccountInput) =>
      fetchMutation<ServiceAccount>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/service-accounts/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {...data},
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: serviceAccountsApiOptions(organization).queryKey,
      }),
  });
}

export function useUpdateServiceAccount(
  organization: Organization,
  serviceAccountId: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceAccountInput) =>
      fetchMutation<ServiceAccount>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
          {path: {organizationIdOrSlug: organization.slug, serviceAccountId}}
        ),
        method: 'PUT',
        data: {...data},
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: serviceAccountApiOptions(organization, serviceAccountId).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: serviceAccountsApiOptions(organization).queryKey,
        }),
      ]),
  });
}

export function useDeleteServiceAccount(
  organization: Organization,
  serviceAccountId: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
          {path: {organizationIdOrSlug: organization.slug, serviceAccountId}}
        ),
        method: 'DELETE',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: serviceAccountsApiOptions(organization).queryKey,
      }),
  });
}
