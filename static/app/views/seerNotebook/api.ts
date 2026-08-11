import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {fetchMutation, QUERY_API_CLIENT} from 'sentry/utils/queryClient';

import type {
  InvestigationBlock,
  InvestigationBlockKind,
  InvestigationCreate,
  InvestigationDetail,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationListItem,
  InvestigationPermissions,
  InvestigationExecutionState,
  InvestigationStatus,
} from './types';

const COLLECTION_PATH = '/organizations/$organizationIdOrSlug/investigations/' as const;
const DETAIL_PATH =
  '/organizations/$organizationIdOrSlug/investigations/$investigationId/' as const;
const PERMISSIONS_PATH =
  '/organizations/$organizationIdOrSlug/investigations/$investigationId/permissions/' as const;

const organizationPath = (organizationSlug: string) => ({
  organizationIdOrSlug: organizationSlug,
});

const investigationPath = (organizationSlug: string, investigationId: string) => ({
  organizationIdOrSlug: organizationSlug,
  investigationId,
});

export function investigationListQueryOptions({
  cursor,
  organizationSlug,
}: {
  organizationSlug: string;
  cursor?: string;
}) {
  return {
    ...apiOptions.as<InvestigationListItem[]>()(COLLECTION_PATH, {
      path: organizationPath(organizationSlug),
      query: {cursor, status: 'active'},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders<InvestigationListItem[]>,
  };
}

export function duplicateInvestigation(
  organizationSlug: string,
  investigationId: string
) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/duplicate/`,
    method: 'POST',
  });
}

export function updateInvestigationFavorite(
  organizationSlug: string,
  investigationId: string,
  shouldFavorite: boolean
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/favorite/`,
    method: 'PUT',
    data: {shouldFavorite},
  });
}

export function investigationDetailQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationDetail>()(DETAIL_PATH, {
    path: investigationPath(organizationSlug, investigationId),
    staleTime: 0,
  });
}

/** @public */ export function investigationPermissionsQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationPermissions>()(PERMISSIONS_PATH, {
    path: investigationPath(organizationSlug, investigationId),
    staleTime: 0,
  });
}

export function createInvestigation(organizationSlug: string, data: InvestigationCreate) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/`,
    method: 'POST',
    data,
  });
}

export function updateInvestigation(
  organizationSlug: string,
  investigationId: string,
  data: {
    investigationVersion: number;
    filters?: InvestigationFilters;
    projectIds?: number[];
    status?: InvestigationStatus;
    title?: string;
  }
) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/`,
    method: 'PUT',
    data,
  });
}

export function archiveInvestigation(
  organizationSlug: string,
  investigationId: string,
  investigationVersion: number
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/`,
    method: 'DELETE',
    data: {investigationVersion},
  });
}

export function createBlock(
  organizationSlug: string,
  investigationId: string,
  data: {
    investigationVersion: number;
    kind: InvestigationBlockKind;
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }
) {
  return fetchMutation<InvestigationBlock>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/`,
    method: 'POST',
    data,
  });
}

export function updateBlock(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  data: {
    investigationVersion: number;
    version: number;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }
) {
  return fetchMutation<InvestigationBlock>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/`,
    method: 'PUT',
    data,
  });
}

export function deleteBlock(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  data: {investigationVersion: number; version: number}
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/`,
    method: 'DELETE',
    data,
  });
}

export function executeBlock(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  data: {investigationVersion: number; requestId: string; version: number}
) {
  return fetchMutation<{id: string; status: string}>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/execute/`,
    method: 'POST',
    data,
  });
}

export function loadTitleGeneration(organizationSlug: string, investigationId: string) {
  return QUERY_API_CLIENT.requestPromise(
    `/organizations/${organizationSlug}/investigations/${investigationId}/title-generation/`,
    {method: 'GET'}
  ) as Promise<{preview: string | null; status: string | null}>;
}

export function loadBlockExecution(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  executionId: string
) {
  return QUERY_API_CLIENT.requestPromise(
    `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/executions/${executionId}/`,
    {method: 'GET'}
  ) as Promise<InvestigationExecutionState>;
}

export function respondToBlockExecution(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  executionId: string,
  data: {inputId: string; responseData: unknown}
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/executions/${executionId}/`,
    method: 'PATCH',
    data,
  });
}

export function stopBlockExecution(
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  executionId: string
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/${blockId}/executions/${executionId}/`,
    method: 'DELETE',
  });
}

export function reorderBlocks(
  organizationSlug: string,
  investigationId: string,
  data: {blockIds: string[]; investigationVersion: number}
) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/blocks/order/`,
    method: 'PUT',
    data,
  });
}

export function updateParameters(
  organizationSlug: string,
  investigationId: string,
  data: {investigationVersion: number; values: Record<string, unknown>}
) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/parameters/`,
    method: 'PUT',
    data,
  });
}

export function updatePermissions(
  organizationSlug: string,
  investigationId: string,
  data: {
    investigationVersion: number;
    isEditableByEveryone: boolean;
    teamIds: number[];
  }
) {
  return fetchMutation<InvestigationPermissions>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/permissions/`,
    method: 'PUT',
    data,
  });
}
