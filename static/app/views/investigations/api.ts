import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {InvestigationListItem} from 'sentry/views/investigations/types';

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

export function createInvestigation(organizationSlug: string) {
  return fetchMutation<InvestigationListItem>({
    url: `/organizations/${organizationSlug}/investigations/`,
    method: 'POST',
    data: {title: 'Untitled investigation'},
  });
}

export function setInvestigationFavorite(
  organizationSlug: string,
  investigationId: string,
  shouldFavorite: boolean
) {
  return fetchMutation({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/favorite/`,
    method: 'PUT',
    data: {shouldFavorite},
  });
}

export function duplicateInvestigation(
  organizationSlug: string,
  investigationId: string
) {
  return fetchMutation<InvestigationListItem>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/duplicate/`,
    method: 'POST',
  });
}

export function archiveInvestigation(
  organizationSlug: string,
  investigation: InvestigationListItem
) {
  return fetchMutation({
    url: `/organizations/${organizationSlug}/investigations/${investigation.id}/`,
    method: 'DELETE',
    data: {investigationVersion: investigation.version},
  });
}
