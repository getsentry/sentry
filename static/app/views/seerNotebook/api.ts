import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {
  InvestigationCell,
  InvestigationCellKind,
  InvestigationComment,
  InvestigationCreate,
  InvestigationDetail,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationListItem,
  InvestigationPermissions,
  InvestigationQueryResult,
  InvestigationReactionName,
  InvestigationStatus,
  InvestigationVisualization,
} from './types';

const COLLECTION_PATH = '/organizations/$organizationIdOrSlug/investigations/' as const;
const DETAIL_PATH =
  '/organizations/$organizationIdOrSlug/investigations/$investigationUuid/' as const;
const PERMISSIONS_PATH =
  '/organizations/$organizationIdOrSlug/investigations/$investigationUuid/permissions/' as const;
const COMMENTS_PATH =
  '/organizations/$organizationIdOrSlug/investigations/$investigationUuid/cells/$cellUuid/comments/' as const;

const organizationPath = (organizationSlug: string) => ({
  organizationIdOrSlug: organizationSlug,
});

const investigationPath = (organizationSlug: string, investigationId: string) => ({
  organizationIdOrSlug: organizationSlug,
  investigationUuid: investigationId,
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

export function investigationPermissionsQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationPermissions>()(PERMISSIONS_PATH, {
    path: investigationPath(organizationSlug, investigationId),
    staleTime: 0,
  });
}

export function investigationCommentsQueryOptions({
  cellId,
  investigationId,
  organizationSlug,
}: {
  cellId: string;
  investigationId: string;
  organizationSlug: string;
}) {
  return apiOptions.asInfinite<InvestigationComment[]>()(COMMENTS_PATH, {
    path: {
      ...investigationPath(organizationSlug, investigationId),
      cellUuid: cellId,
    },
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

export function createCell(
  organizationSlug: string,
  investigationId: string,
  data: {
    investigationVersion: number;
    kind: InvestigationCellKind;
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }
) {
  return fetchMutation<InvestigationCell>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/`,
    method: 'POST',
    data,
  });
}

export function updateCell(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  data: {
    investigationVersion: number;
    version: number;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }
) {
  return fetchMutation<InvestigationCell>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/`,
    method: 'PUT',
    data,
  });
}

export function deleteCell(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  data: {investigationVersion: number; version: number}
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/`,
    method: 'DELETE',
    data,
  });
}

export function executeCell(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  data: {investigationVersion: number; version: number}
) {
  return fetchMutation<{id: string; status: string}>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/execute/`,
    method: 'POST',
    data,
  });
}

export function suggestCellVisualization(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  data: {
    currentIntent: string;
    currentResult: InvestigationQueryResult;
    requestedChange: string;
    visualization: InvestigationVisualization;
  }
) {
  return fetchMutation<{
    existingResultSufficient: boolean;
    visualization: InvestigationVisualization;
    revisedQueryIntent?: string;
  }>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/visualization-suggestion/`,
    method: 'POST',
    data,
  });
}

export function reorderCells(
  organizationSlug: string,
  investigationId: string,
  data: {cellIds: string[]; investigationVersion: number}
) {
  return fetchMutation<InvestigationDetail>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/order/`,
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

export function createComment(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  data: {body: string; mentions: string[]}
) {
  return fetchMutation<InvestigationComment>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/comments/`,
    method: 'POST',
    data,
  });
}

export function updateComment(
  organizationSlug: string,
  investigationId: string,
  commentId: string,
  data: {body: string; mentions: string[]}
) {
  return fetchMutation<InvestigationComment>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/comments/${commentId}/`,
    method: 'PUT',
    data,
  });
}

export function deleteComment(
  organizationSlug: string,
  investigationId: string,
  commentId: string
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/comments/${commentId}/`,
    method: 'DELETE',
  });
}

export function setCellReaction(
  organizationSlug: string,
  investigationId: string,
  cellId: string,
  reaction: InvestigationReactionName,
  enabled: boolean
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/cells/${cellId}/reactions/${reaction}/`,
    method: enabled ? 'PUT' : 'DELETE',
  });
}

export function setCommentReaction(
  organizationSlug: string,
  investigationId: string,
  commentId: string,
  reaction: InvestigationReactionName,
  enabled: boolean
) {
  return fetchMutation<void>({
    url: `/organizations/${organizationSlug}/investigations/${investigationId}/comments/${commentId}/reactions/${reaction}/`,
    method: enabled ? 'PUT' : 'DELETE',
  });
}
