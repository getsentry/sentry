import type {QueryClient} from '@tanstack/react-query';

import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {
  archiveInvestigation,
  createCell,
  createComment,
  deleteCell,
  deleteComment,
  executeCell,
  investigationCommentsQueryOptions,
  investigationDetailQueryOptions,
  reorderCells,
  setCellReaction,
  setCommentReaction,
  suggestCellVisualization,
  updateCell,
  updateComment,
  updateInvestigation,
  updateInvestigationFavorite,
  updateParameters,
  updatePermissions,
} from 'sentry/views/seerNotebook/api';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';
import type {
  InvestigationCell,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationPermissions,
  InvestigationQueryResult,
  InvestigationReactionName,
  InvestigationVisualization,
} from 'sentry/views/seerNotebook/types';

export class QueryClientInvestigationTransport implements InvestigationTransport {
  constructor(
    private readonly queryClient: QueryClient,
    private readonly organizationSlug: string,
    private readonly investigationId: string
  ) {}

  async loadDetail() {
    const response = await this.queryClient.fetchQuery(
      investigationDetailQueryOptions(this.organizationSlug, this.investigationId)
    );
    return response.json;
  }

  updateInvestigation(data: {
    investigationVersion: number;
    filters?: InvestigationFilters;
    projectIds?: number[];
    status?: 'active' | 'archived';
    title?: string;
  }) {
    return updateInvestigation(this.organizationSlug, this.investigationId, data);
  }

  archiveInvestigation(investigationVersion: number) {
    return archiveInvestigation(
      this.organizationSlug,
      this.investigationId,
      investigationVersion
    );
  }

  updateFavorite(shouldFavorite: boolean) {
    return updateInvestigationFavorite(
      this.organizationSlug,
      this.investigationId,
      shouldFavorite
    );
  }

  createCell(data: {
    investigationVersion: number;
    kind: InvestigationCell['kind'];
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }) {
    return createCell(this.organizationSlug, this.investigationId, data);
  }

  updateCell(
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
    return updateCell(this.organizationSlug, this.investigationId, cellId, data);
  }

  deleteCell(cellId: string, data: {investigationVersion: number; version: number}) {
    return deleteCell(this.organizationSlug, this.investigationId, cellId, data);
  }

  executeCell(
    cellId: string,
    data: {investigationVersion: number; requestId: string; version: number}
  ) {
    return executeCell(this.organizationSlug, this.investigationId, cellId, data);
  }

  reorderCells(data: {cellIds: string[]; investigationVersion: number}) {
    return reorderCells(this.organizationSlug, this.investigationId, data);
  }

  updateParameters(investigationVersion: number, values: Record<string, unknown>) {
    return updateParameters(this.organizationSlug, this.investigationId, {
      investigationVersion,
      values,
    });
  }

  updatePermissions(
    investigationVersion: number,
    permissions: Pick<InvestigationPermissions, 'isEditableByEveryone' | 'teamIds'>
  ) {
    return updatePermissions(this.organizationSlug, this.investigationId, {
      investigationVersion,
      ...permissions,
    });
  }

  suggestVisualization(
    cellId: string,
    data: {
      currentIntent: string;
      currentResult: InvestigationQueryResult;
      requestedChange: string;
      visualization: InvestigationVisualization;
    }
  ) {
    return suggestCellVisualization(
      this.organizationSlug,
      this.investigationId,
      cellId,
      data
    );
  }

  async loadComments(cellId: string, pageCount: number) {
    const response = await this.queryClient.fetchInfiniteQuery({
      ...investigationCommentsQueryOptions({
        cellId,
        investigationId: this.investigationId,
        organizationSlug: this.organizationSlug,
      }),
      pages: pageCount,
    });
    const lastPage = response.pages.at(-1);
    const next = parseLinkHeader(lastPage?.headers.Link ?? null).next;
    return {
      items: response.pages.flatMap(page => page.json),
      nextCursor: next?.results ? next.cursor : null,
    };
  }

  createComment(cellId: string, data: {body: string; mentions: string[]}) {
    return createComment(this.organizationSlug, this.investigationId, cellId, data);
  }

  updateComment(commentId: string, data: {body: string; mentions: string[]}) {
    return updateComment(this.organizationSlug, this.investigationId, commentId, data);
  }

  deleteComment(commentId: string) {
    return deleteComment(this.organizationSlug, this.investigationId, commentId);
  }

  setCellReaction(cellId: string, reaction: InvestigationReactionName, enabled: boolean) {
    return setCellReaction(
      this.organizationSlug,
      this.investigationId,
      cellId,
      reaction,
      enabled
    );
  }

  setCommentReaction(
    commentId: string,
    reaction: InvestigationReactionName,
    enabled: boolean
  ) {
    return setCommentReaction(
      this.organizationSlug,
      this.investigationId,
      commentId,
      reaction,
      enabled
    );
  }
}
