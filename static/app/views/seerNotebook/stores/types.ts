import type {BlockStoreSnapshot} from 'sentry/views/seerNotebook/stores/blockStore';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationPermissions,
  InvestigationExecutionState,
} from 'sentry/views/seerNotebook/types';

/** @public */ export type NotebookMutationFailurePolicy = 'rollback' | 'retain-draft';

/** @public */ export type NotebookOperationState =
  | 'queued'
  | 'running'
  | 'conflicted'
  | 'failed';

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

export interface InvestigationTransport {
  archiveInvestigation(investigationVersion: number): Promise<void>;
  createBlock(data: {
    investigationVersion: number;
    kind: InvestigationBlock['kind'];
    config?: Record<string, unknown>;
    content?: string;
    display?: InvestigationDisplay;
    generationPrompt?: string;
    title?: string;
  }): Promise<InvestigationBlock>;
  deleteBlock(
    blockId: string,
    data: {investigationVersion: number; version: number}
  ): Promise<void>;
  executeBlock(
    blockId: string,
    data: {investigationVersion: number; requestId: string; version: number}
  ): Promise<{id: string; status: string}>;
  loadBlockExecution(
    blockId: string,
    executionId: string
  ): Promise<InvestigationExecutionState>;
  loadDetail(): Promise<InvestigationDetail>;
  loadTitleGeneration(): Promise<{
    preview: string | null;
    status: string | null;
  }>;
  reorderBlocks(data: {
    blockIds: string[];
    investigationVersion: number;
  }): Promise<InvestigationDetail>;
  respondToBlockExecution(
    blockId: string,
    executionId: string,
    data: {inputId: string; responseData: unknown}
  ): Promise<void>;
  stopBlockExecution(blockId: string, executionId: string): Promise<void>;
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
  ): Promise<InvestigationBlock>;
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
      blockId: string;
      eventId: string;
      kind: 'block.upserted';
      payload: InvestigationBlock;
      sequence: number;
      clientMutationId?: string;
    }
  | {
      blockId: string;
      eventId: string;
      kind: 'block.deleted';
      sequence: number;
      clientMutationId?: string;
    }
  | {
      blockIds: string[];
      eventId: string;
      kind: 'blocks.reordered';
      sequence: number;
      clientMutationId?: string;
    }
  | {
      blockId: string;
      eventId: string;
      kind: 'execution.updated';
      payload: Pick<
        InvestigationBlock,
        | 'content'
        | 'currentExecution'
        | 'generatedContent'
        | 'output'
        | 'outputStatus'
        | 'staleAt'
      >;
      sequence: number;
      clientMutationId?: string;
    };

export type NotebookStoreSnapshot = {
  blockKeys: string[];
  blocks: BlockStoreSnapshot[];
  conflict: NotebookConflict | null;
  filters: InvestigationFilters;
  investigationId: string;
  isSaving: boolean;
  lastRemoteEventSequence: number;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  organizationSlug: string;
  parameterSaveState: string;
  parameterValues: Record<string, unknown>;
  projectIds: number[];
  title: string;
  version: number;
};
