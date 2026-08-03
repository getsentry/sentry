import type {CellStoreSnapshot} from 'sentry/views/seerNotebook/stores/cellStore';
import type {
  InvestigationCell,
  InvestigationComment,
  InvestigationDetail,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationPermissions,
  InvestigationReactionName,
  InvestigationVisualization,
} from 'sentry/views/seerNotebook/types';

export type NotebookMutationFailurePolicy = 'rollback' | 'retain-draft';

export type NotebookOperationState = 'queued' | 'running' | 'conflicted' | 'failed';

export type NotebookOperation<T = unknown> = {
  affectedFields: ReadonlySet<string>;
  execute: (investigationVersion: number) => Promise<T>;
  failurePolicy: NotebookMutationFailurePolicy;
  id: string;
  kind: string;
  onCommit: (result: T) => void;
  state: NotebookOperationState;
  onRollback?: () => void;
};

export type NotebookConflict = {
  operationId: string;
  operationKind: string;
};

export type CommentPage = {
  items: InvestigationComment[];
  nextCursor: string | null;
};

export interface InvestigationTransport {
  archiveInvestigation(investigationVersion: number): Promise<void>;
  createCell(data: {
    investigationVersion: number;
    kind: InvestigationCell['kind'];
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }): Promise<InvestigationCell>;
  createComment(
    cellId: string,
    data: {body: string; mentions: string[]}
  ): Promise<InvestigationComment>;
  deleteCell(
    cellId: string,
    data: {investigationVersion: number; version: number}
  ): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  executeCell(
    cellId: string,
    data: {investigationVersion: number; requestId: string; version: number}
  ): Promise<{id: string; status: string}>;
  loadComments(cellId: string, pageCount: number): Promise<CommentPage>;
  loadDetail(): Promise<InvestigationDetail>;
  reorderCells(data: {
    cellIds: string[];
    investigationVersion: number;
  }): Promise<InvestigationDetail>;
  setCellReaction(
    cellId: string,
    reaction: InvestigationReactionName,
    enabled: boolean
  ): Promise<void>;
  setCommentReaction(
    commentId: string,
    reaction: InvestigationReactionName,
    enabled: boolean
  ): Promise<void>;
  suggestVisualization(
    cellId: string,
    data: {
      currentIntent: string;
      currentResult: NonNullable<InvestigationCell['output']>;
      requestedChange: string;
      visualization: InvestigationVisualization;
    }
  ): Promise<{
    existingResultSufficient: boolean;
    visualization: InvestigationVisualization;
    revisedQueryIntent?: string;
  }>;
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
  ): Promise<InvestigationCell>;
  updateComment(
    commentId: string,
    data: {body: string; mentions: string[]}
  ): Promise<InvestigationComment>;
  updateFavorite(shouldFavorite: boolean): Promise<void>;
  updateInvestigation(data: {
    investigationVersion: number;
    filters?: InvestigationFilters;
    projectIds?: number[];
    status?: InvestigationDetail['status'];
    title?: string;
  }): Promise<InvestigationDetail>;
  updateParameters(
    investigationVersion: number,
    values: Record<string, unknown>
  ): Promise<InvestigationDetail>;
  updatePermissions(
    investigationVersion: number,
    permissions: Pick<InvestigationPermissions, 'isEditableByEveryone' | 'teamIds'>
  ): Promise<InvestigationPermissions>;
}

export interface NotebookTimers {
  clearInterval(handle: ReturnType<typeof setInterval>): void;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
  setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval>;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
}

export type NotebookRemoteEvent =
  | {
      eventId: string;
      kind: 'snapshot';
      payload: InvestigationDetail;
      sequence: number;
      clientMutationId?: string;
    }
  | {
      eventId: string;
      kind: 'notebook.updated';
      payload: Partial<
        Pick<
          InvestigationDetail,
          'filters' | 'parameters' | 'permissions' | 'projectIds' | 'status' | 'title'
        >
      > & {version: number};
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellId: string;
      eventId: string;
      kind: 'cell.upserted';
      payload: InvestigationCell;
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellId: string;
      eventId: string;
      kind: 'cell.deleted';
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellIds: string[];
      eventId: string;
      kind: 'cells.reordered';
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellId: string;
      eventId: string;
      kind: 'execution.updated';
      payload: Pick<
        InvestigationCell,
        | 'content'
        | 'currentExecution'
        | 'generatedContent'
        | 'output'
        | 'outputStatus'
        | 'staleAt'
      >;
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellId: string;
      comment: InvestigationComment;
      eventId: string;
      kind: 'comment.upserted';
      sequence: number;
      clientMutationId?: string;
    }
  | {
      cellId: string;
      commentId: string;
      eventId: string;
      kind: 'comment.deleted';
      sequence: number;
      clientMutationId?: string;
    };

export type NotebookStoreSnapshot = {
  cellKeys: string[];
  cells: CellStoreSnapshot[];
  conflict: NotebookConflict | null;
  filters: InvestigationFilters;
  investigationId: string;
  isSaving: boolean;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  organizationSlug: string;
  projectIds: number[];
  title: string;
  version: number;
};
