import type {QueryClient} from '@tanstack/react-query';

import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {
  archiveInvestigation,
  createBlock,
  createComment,
  deleteBlock,
  deleteComment,
  executeBlock,
  investigationCommentsQueryOptions,
  investigationDetailQueryOptions,
  loadBlockExecution,
  loadTitleGeneration,
  reorderBlocks,
  setBlockReaction,
  setCommentReaction,
  respondToBlockExecution,
  stopBlockExecution,
  updateBlock,
  updateComment,
  updateInvestigation,
  updateInvestigationFavorite,
  updateParameters,
  updatePermissions,
} from 'sentry/views/seerNotebook/api';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';
import type {
  InvestigationBlock,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationPermissions,
  InvestigationReactionName,
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

  loadTitleGeneration() {
    return loadTitleGeneration(this.organizationSlug, this.investigationId);
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

  createBlock(data: {
    investigationVersion: number;
    kind: InvestigationBlock['kind'];
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }) {
    return createBlock(this.organizationSlug, this.investigationId, data);
  }

  updateBlock(
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
    return updateBlock(this.organizationSlug, this.investigationId, blockId, data);
  }

  deleteBlock(blockId: string, data: {investigationVersion: number; version: number}) {
    return deleteBlock(this.organizationSlug, this.investigationId, blockId, data);
  }

  executeBlock(
    blockId: string,
    data: {investigationVersion: number; requestId: string; version: number}
  ) {
    return executeBlock(this.organizationSlug, this.investigationId, blockId, data);
  }

  loadBlockExecution(blockId: string, executionId: string) {
    return loadBlockExecution(
      this.organizationSlug,
      this.investigationId,
      blockId,
      executionId
    );
  }

  respondToBlockExecution(
    blockId: string,
    executionId: string,
    data: {inputId: string; responseData: unknown}
  ) {
    return respondToBlockExecution(
      this.organizationSlug,
      this.investigationId,
      blockId,
      executionId,
      data
    );
  }

  stopBlockExecution(blockId: string, executionId: string) {
    return stopBlockExecution(
      this.organizationSlug,
      this.investigationId,
      blockId,
      executionId
    );
  }

  reorderBlocks(data: {blockIds: string[]; investigationVersion: number}) {
    return reorderBlocks(this.organizationSlug, this.investigationId, data);
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

  async loadComments(blockId: string, pageCount: number) {
    const response = await this.queryClient.fetchInfiniteQuery({
      ...investigationCommentsQueryOptions({
        blockId,
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

  createComment(blockId: string, data: {body: string; mentions: string[]}) {
    return createComment(this.organizationSlug, this.investigationId, blockId, data);
  }

  updateComment(commentId: string, data: {body: string; mentions: string[]}) {
    return updateComment(this.organizationSlug, this.investigationId, commentId, data);
  }

  deleteComment(commentId: string) {
    return deleteComment(this.organizationSlug, this.investigationId, commentId);
  }

  setBlockReaction(
    blockId: string,
    reaction: InvestigationReactionName,
    enabled: boolean
  ) {
    return setBlockReaction(
      this.organizationSlug,
      this.investigationId,
      blockId,
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
