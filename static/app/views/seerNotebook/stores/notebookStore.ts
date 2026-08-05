import isEqual from 'lodash/isEqual';
import {action, computed, makeObservable, observable, runInAction} from 'mobx';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {BlockStore} from 'sentry/views/seerNotebook/stores/blockStore';
import type {
  InvestigationTransport,
  NotebookConflict,
  NotebookOperation,
  NotebookRemoteEvent,
  NotebookStoreSnapshot,
  NotebookTimers,
} from 'sentry/views/seerNotebook/stores/types';
import type {
  InvestigationDetail,
  InvestigationFilters,
  InvestigationParameter,
  InvestigationPermissions,
} from 'sentry/views/seerNotebook/types';

const browserTimers: NotebookTimers = {
  clearInterval: handle => clearInterval(handle),
  clearTimeout: handle => clearTimeout(handle),
  setInterval: (callback, delay) => setInterval(callback, delay),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
};

type NotebookStoreOptions = {
  idGenerator: () => string;
  investigationId: string;
  organizationSlug: string;
  queryExecutionEnabled: boolean;
  transport: InvestigationTransport;
  timers?: NotebookTimers;
};

export type ParameterValidationError = {
  code:
    | 'required'
    | 'text'
    | 'max_length'
    | 'number'
    | 'integer_seconds'
    | 'min'
    | 'max'
    | 'enum'
    | 'date_range'
    | 'date_order'
    | 'max_days'
    | 'duplicate_environments'
    | 'max_environments'
    | 'duplicate_projects';
  limit?: number;
};

type ParameterSaveState = 'idle' | 'scheduled' | 'saving' | 'unsaved' | 'invalid';

export class NotebookStore {
  readonly investigationId: string;
  readonly organizationSlug: string;
  readonly queryExecutionEnabled: boolean;
  readonly transport: InvestigationTransport;
  readonly timers: NotebookTimers;

  loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  loadError: string | null = null;
  mutationError: string | null = null;
  conflict: NotebookConflict | null = null;
  title = '';
  titleDraft = '';
  status: InvestigationDetail['status'] = 'active';
  sourceType = '';
  source: InvestigationDetail['source'] = {type: '', ref: {}, revision: null};
  template: InvestigationDetail['template'] = null;
  dateCreated = '';
  dateUpdated = '';
  createdBy: string | null = null;
  isFavorited = false;
  isUpdatingFavorite = false;
  blockCount = 0;
  filters: InvestigationFilters = {};
  projectIds: number[] = [];
  parameters: InvestigationParameter[] = [];
  parameterValues: Record<string, unknown> = {};
  parameterErrors: Record<string, ParameterValidationError> = {};
  parameterSaveState: ParameterSaveState = 'idle';
  isUpdatingAccess = false;
  permissions: InvestigationPermissions = {
    canEdit: false,
    canManage: false,
    isEditableByEveryone: false,
    teamIds: [],
  };
  version = 0;
  blockKeys: string[] = [];
  blocks = new Map<string, BlockStore>();
  pendingOperations = new Map<string, NotebookOperation>();
  titleDirty = false;
  titleGenerationStatus: string | null = null;
  titleGenerationPreview: string | null = null;
  lastRemoteEventSequence = -1;

  private readonly idGenerator: () => string;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private conflictedOperation: NotebookOperation | null = null;
  private blockCreationPromises = new Map<string, Promise<void>>();
  private executionPollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshRequestOrdinal = 0;
  private lastAppliedRefreshOrdinal = 0;
  private disposed = false;
  private appliedRemoteEventIds = new Set<string>();
  private confirmedParameterValues: Record<string, unknown> = {};
  private parameterSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private parameterSavePromise: Promise<void> | null = null;

  constructor(options: NotebookStoreOptions) {
    this.investigationId = options.investigationId;
    this.organizationSlug = options.organizationSlug;
    this.queryExecutionEnabled = options.queryExecutionEnabled;
    this.transport = options.transport;
    this.timers = options.timers ?? browserTimers;
    this.idGenerator = options.idGenerator;

    makeObservable(this, {
      loadState: observable,
      loadError: observable,
      mutationError: observable,
      conflict: observable.ref,
      title: observable,
      titleDraft: observable,
      status: observable,
      sourceType: observable,
      source: observable.ref,
      template: observable.ref,
      dateCreated: observable,
      dateUpdated: observable,
      createdBy: observable,
      isFavorited: observable,
      isUpdatingFavorite: observable,
      blockCount: observable,
      filters: observable.ref,
      projectIds: observable.shallow,
      parameters: observable.shallow,
      parameterValues: observable.ref,
      parameterErrors: observable.ref,
      parameterSaveState: observable,
      isUpdatingAccess: observable,
      permissions: observable.ref,
      version: observable,
      blockKeys: observable.shallow,
      blocks: observable.shallow,
      pendingOperations: observable.shallow,
      titleDirty: observable,
      titleGenerationStatus: observable,
      titleGenerationPreview: observable,
      lastRemoteEventSequence: observable,
      blocksInOrder: computed,
      detail: computed,
      isReadOnly: computed,
      isSaving: computed,
      canExecuteQueries: computed,
      isTitleGenerating: computed,
      hasPendingExecution: computed,
      load: action,
      retryLoad: action,
      applyRemoteSnapshot: action,
      applyRemoteEvent: action,
      dispose: action,
      reloadLatest: action,
      retryChange: action,
      enqueueOperation: action,
      refreshDetail: action,
      runBlock: action,
      editTitle: action,
      cancelTitleEdit: action,
      commitTitle: action,
      toggleFavorite: action,
      saveMetadata: action,
      editParameterValue: action,
      flushParameterValues: action,
      updateParameterValues: action,
      updateAccess: action,
      archive: action,
      restoreInvestigation: action,
      insertBlock: action,
      deleteBlock: action,
      moveBlock: action,
    });
  }

  get blocksInOrder(): BlockStore[] {
    return this.blockKeys
      .map(key => this.blocks.get(key))
      .filter((block): block is BlockStore => block !== undefined && !block.isDeleted);
  }

  get detail(): InvestigationDetail {
    return {
      id: this.investigationId,
      title: this.title,
      status: this.status,
      sourceType: this.sourceType,
      source: this.source,
      template: this.template,
      dateCreated: this.dateCreated,
      dateUpdated: this.dateUpdated,
      createdBy: this.createdBy,
      isFavorited: this.isFavorited,
      blockCount: this.blocksInOrder.length,
      filters: this.filters,
      projectIds: this.projectIds,
      parameters: this.parameters,
      permissions: this.permissions,
      version: this.version,
      blocks: this.blocksInOrder.map(block => block.toInvestigationBlock()),
      titleGeneration: {status: this.titleGenerationStatus},
    };
  }

  get isReadOnly(): boolean {
    return this.status === 'archived' || !this.permissions.canEdit;
  }

  get isSaving(): boolean {
    return this.pendingOperations.size > 0;
  }

  get canExecuteQueries(): boolean {
    return !this.isReadOnly && this.queryExecutionEnabled;
  }

  get isTitleGenerating(): boolean {
    return (
      this.titleGenerationStatus === 'pending' || this.titleGenerationStatus === 'running'
    );
  }

  createClientId(): string {
    return this.idGenerator();
  }

  get hasPendingExecution(): boolean {
    return (
      this.isTitleGenerating || this.blocksInOrder.some(block => block.isExecutionRunning)
    );
  }

  async load(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.loadState = 'loading';
    this.loadError = null;
    try {
      const detail = await this.transport.loadDetail();
      runInAction(() => {
        if (!this.disposed) {
          this.applyRemoteSnapshot(detail);
          this.loadState = 'ready';
        }
      });
    } catch {
      runInAction(() => {
        if (!this.disposed) {
          this.loadState = 'error';
          this.loadError = 'load_failed';
        }
      });
    }
  }

  retryLoad(): Promise<void> {
    return this.load();
  }

  async refreshDetail(): Promise<void> {
    if (this.disposed || this.conflict) {
      return;
    }
    const requestOrdinal = ++this.refreshRequestOrdinal;
    const detail = await this.transport.loadDetail();
    runInAction(() => {
      if (
        !this.disposed &&
        !this.conflict &&
        requestOrdinal >= this.lastAppliedRefreshOrdinal
      ) {
        this.lastAppliedRefreshOrdinal = requestOrdinal;
        this.applyRemoteSnapshot(detail);
      }
    });
  }

  applyRemoteSnapshot(detail: InvestigationDetail) {
    if (this.disposed) {
      return;
    }

    if (!this.titleDirty) {
      this.title = detail.title;
      this.titleDraft = detail.title;
    }
    this.titleGenerationStatus = detail.titleGeneration?.status ?? null;
    this.status = detail.status;
    this.sourceType = detail.sourceType;
    this.source = detail.source;
    this.template = detail.template;
    this.dateCreated = detail.dateCreated;
    this.dateUpdated = detail.dateUpdated;
    this.createdBy = detail.createdBy;
    this.isFavorited = detail.isFavorited;
    this.blockCount = detail.blockCount;
    if (!this.findPendingOperation(['notebook.filters'])) {
      this.filters = detail.filters;
    }
    if (!this.findPendingOperation(['notebook.projectIds'])) {
      this.projectIds = detail.projectIds;
    }
    this.applyRemoteParameters(detail.parameters);
    this.permissions = detail.permissions;
    this.version = Math.max(this.version, detail.version);

    const nextKeys: string[] = [];
    const incomingServerIds = new Set(detail.blocks.map(block => block.id));
    for (const incoming of detail.blocks) {
      const existing = this.findBlockByServerId(incoming.id);
      if (existing) {
        if (
          existing.isDeleted &&
          this.findPendingOperation([`${existing.clientKey}.deleted`])
        ) {
          nextKeys.push(existing.clientKey);
          continue;
        }
        existing.applyServerSnapshot(incoming);
        nextKeys.push(existing.clientKey);
      } else {
        const block = new BlockStore(this, incoming);
        this.blocks.set(block.clientKey, block);
        nextKeys.push(block.clientKey);
      }
    }

    for (const key of this.blockKeys) {
      const block = this.blocks.get(key);
      if (!block?.serverId) {
        if (block && !nextKeys.includes(key)) {
          nextKeys.push(key);
        }
        continue;
      }
      if (block.isDeleted) {
        if (this.findPendingOperation([`${block.clientKey}.deleted`])) {
          if (!nextKeys.includes(key)) {
            nextKeys.push(key);
          }
        } else {
          block.dispose();
          this.blocks.delete(key);
        }
        continue;
      }
      if (!incomingServerIds.has(block.serverId) && !block.isDirty) {
        block.dispose();
        this.blocks.delete(key);
      }
    }
    this.blockKeys = nextKeys;
    this.syncExecutionPolling();
  }

  applyRemoteEvent(event: NotebookRemoteEvent) {
    if (
      this.disposed ||
      this.appliedRemoteEventIds.has(event.eventId) ||
      event.sequence < this.lastRemoteEventSequence
    ) {
      return;
    }
    this.appliedRemoteEventIds.add(event.eventId);
    this.lastRemoteEventSequence = Math.max(this.lastRemoteEventSequence, event.sequence);
    const acknowledgedOperation = event.clientMutationId
      ? (this.pendingOperations.get(event.clientMutationId) ?? null)
      : null;
    if (event.clientMutationId) {
      this.pendingOperations.delete(event.clientMutationId);
    }

    if (event.kind === 'snapshot') {
      this.applyRemoteSnapshot(event.payload);
      return;
    }
    if (event.kind === 'notebook.updated') {
      const operation = this.findPendingOperation([
        'notebook.filters',
        'notebook.parameters',
        'notebook.permissions',
        'notebook.projectIds',
        'notebook.status',
        'notebook.title',
      ]);
      if (operation && event.clientMutationId !== operation.id) {
        this.enterRemoteConflict(operation, event.eventId);
      }
      if (event.payload.title !== undefined && !this.titleDirty) {
        this.title = event.payload.title;
        this.titleDraft = event.payload.title;
      }
      if (
        event.payload.filters !== undefined &&
        !this.findPendingOperation(['notebook.filters'])
      ) {
        this.filters = event.payload.filters;
      }
      if (
        event.payload.projectIds !== undefined &&
        !this.findPendingOperation(['notebook.projectIds'])
      ) {
        this.projectIds = event.payload.projectIds;
      }
      if (event.payload.parameters !== undefined) {
        this.applyRemoteParameters(event.payload.parameters);
      }
      if (
        event.payload.permissions !== undefined &&
        !this.findPendingOperation(['notebook.permissions'])
      ) {
        this.permissions = event.payload.permissions;
      }
      if (
        event.payload.status !== undefined &&
        !this.findPendingOperation(['notebook.status'])
      ) {
        this.status = event.payload.status;
      }
      this.version = Math.max(this.version, event.payload.version);
      return;
    }

    if (event.kind === 'blocks.reordered') {
      const operation = this.findPendingOperation(['notebook.blockOrder']);
      if (operation && event.clientMutationId !== operation.id) {
        this.enterRemoteConflict(operation, event.eventId);
        return;
      }
      const ordered = event.blockIds.flatMap(id => {
        const block = this.findBlockByServerId(id);
        return block ? [block.clientKey] : [];
      });
      const unmentioned = this.blockKeys.filter(key => !ordered.includes(key));
      this.blockKeys = [...ordered, ...unmentioned];
      this.updateBlockPositions();
      return;
    }

    let block = this.findBlockByServerId(event.blockId);
    if (event.kind === 'block.upserted') {
      if (!block && acknowledgedOperation?.kind === 'block.create') {
        const clientKey = [...acknowledgedOperation.affectedFields]
          .find(field => field.endsWith('.created'))
          ?.slice(0, -'.created'.length);
        block = clientKey ? this.blocks.get(clientKey) : undefined;
        block?.attachServerId(event.blockId);
      }
      if (block?.isDeleted) {
        return;
      }
      const conflicts = block?.getConflictingDirtyFields(event.payload) ?? [];
      if (conflicts.length) {
        const operation = this.findPendingOperation(
          conflicts.map(field => `${block!.clientKey}.${field}`)
        );
        this.enterRemoteConflict(operation, event.eventId);
      }
      if (block) {
        if (acknowledgedOperation?.kind === 'block.save') {
          block.acknowledgeRemoteSnapshot(event.payload);
        } else {
          block.applyServerSnapshot(event.payload);
        }
      } else {
        const inserted = new BlockStore(this, event.payload);
        this.blocks.set(inserted.clientKey, inserted);
        this.blockKeys = [...this.blockKeys, inserted.clientKey];
      }
      return;
    }
    if (!block) {
      return;
    }
    if (event.kind === 'block.deleted') {
      const operation = this.findPendingOperation([`${block.clientKey}.`]);
      if (block.isDirty || operation) {
        this.enterRemoteConflict(operation, event.eventId);
        return;
      }
      block.dispose();
      this.blocks.delete(block.clientKey);
      this.blockKeys = this.blockKeys.filter(key => key !== block.clientKey);
      return;
    }
    if (event.kind === 'execution.updated') {
      block.applyExecutionUpdate(event.payload);
      this.syncExecutionPolling();
      return;
    }
    if (event.kind === 'comment.upserted') {
      block.applyRemoteComment(event.comment);
      return;
    }
    if (event.kind === 'comment.deleted') {
      block.removeRemoteComment(event.commentId);
      return;
    }
    if (event.kind === 'block.reactions.updated') {
      block.applyRemoteReactions(event.payload);
      return;
    }
    if (event.kind === 'comment.reactions.updated') {
      block.applyRemoteCommentReactions(event.commentId, event.payload);
    }
  }

  enqueueOperation<T>(operation: Omit<NotebookOperation<T>, 'id' | 'state'>): Promise<T> {
    const queued: NotebookOperation<T> = {
      ...operation,
      id: this.idGenerator(),
      state: 'queued',
    };
    this.pendingOperations.set(queued.id, queued as NotebookOperation);
    const promise = this.operationQueue.then(() => this.executeOperation(queued));
    this.operationQueue = promise.catch(() => {});
    return promise;
  }

  saveBlock(block: BlockStore): Promise<void> {
    if (!block.serverId) {
      const creation = this.blockCreationPromises.get(block.clientKey);
      if (!creation) {
        return Promise.reject(
          new Error('The block must be created before it can be saved.')
        );
      }
      return creation.then(() => this.saveBlock(block));
    }
    const {fields, values} = block.getPendingSave();
    if (fields.length === 0) {
      return Promise.resolve();
    }
    block.markSaveStarted();
    const serverId = block.serverId;
    return this.enqueueOperation({
      affectedFields: new Set(fields.map(field => `${block.clientKey}.${field}`)),
      execute: investigationVersion =>
        this.transport.updateBlock(serverId, {
          investigationVersion,
          version: block.version,
          ...values,
        }),
      failurePolicy: 'retain-draft',
      kind: 'block.save',
      onCommit: result => {
        this.version += 1;
        block.confirmSave(result, fields, values);
      },
    })
      .then(() => {})
      .catch(error => {
        block.failSave();
        throw error;
      });
  }

  async runBlock(block: BlockStore, options: {retry: boolean}): Promise<void> {
    if (
      this.isReadOnly ||
      !this.queryExecutionEnabled ||
      block.isExecutionRunning ||
      !block.executionIntent.trim()
    ) {
      return;
    }
    const requestId =
      options.retry && block.failedRunRequestId
        ? block.failedRunRequestId
        : this.idGenerator();
    block.beginRunRequest(requestId);
    try {
      await block.flush();
      if (!block.serverId) {
        throw new Error('The block must be persisted before it can run.');
      }
      runInAction(() => block.markExecutionPending());
      const result = await this.transport.executeBlock(block.serverId, {
        investigationVersion: this.version,
        requestId,
        version: block.version,
      });
      runInAction(() => {
        block.markExecutionAccepted(result);
        this.syncExecutionPolling();
      });
    } catch (error) {
      runInAction(() => block.failRunRequest(requestId));
      throw error;
    } finally {
      runInAction(() => block.finishRunRequest(requestId));
    }
  }

  editTitle(value: string) {
    this.titleDraft = value;
    this.titleDirty = value.trim() !== this.title;
  }

  cancelTitleEdit() {
    this.titleDraft = this.title;
    this.titleDirty = false;
  }

  commitTitle(): Promise<void> {
    const nextTitle = this.titleDraft.trim();
    if (!nextTitle || nextTitle === this.title) {
      this.cancelTitleEdit();
      return Promise.resolve();
    }
    const previousTitle = this.title;
    this.title = nextTitle;
    this.titleDraft = nextTitle;
    this.titleDirty = true;
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.title']),
      execute: investigationVersion =>
        this.transport.updateInvestigation({
          investigationVersion,
          title: nextTitle,
        }),
      failurePolicy: 'rollback',
      kind: 'notebook.rename',
      onCommit: detail => {
        if (this.titleDraft === nextTitle) {
          this.titleDirty = false;
        }
        this.applyRemoteSnapshot(detail);
      },
      onRollback: () => {
        if (this.title === nextTitle) {
          this.title = previousTitle;
          this.titleDraft = previousTitle;
          this.titleDirty = false;
        }
      },
    }).then(() => {});
  }

  toggleFavorite(): Promise<void> {
    if (this.isUpdatingFavorite) {
      return Promise.resolve();
    }
    const previous = this.isFavorited;
    const next = !previous;
    this.isFavorited = next;
    this.isUpdatingFavorite = true;
    return this.transport
      .updateFavorite(next)
      .catch(error => {
        runInAction(() => {
          if (this.isFavorited === next) {
            this.isFavorited = previous;
          }
          this.mutationError = 'favorite_failed';
        });
        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.isUpdatingFavorite = false;
        });
      });
  }

  saveMetadata(values: {
    filters?: Partial<InvestigationFilters>;
    projectIds?: number[];
  }): Promise<void> {
    const previousFilters = this.filters;
    const previousProjects = this.projectIds;
    const nextFilters = values.filters
      ? {...this.filters, ...values.filters}
      : this.filters;
    const nextProjects = values.projectIds ?? this.projectIds;
    this.filters = nextFilters;
    this.projectIds = nextProjects;
    for (const block of this.blocksInOrder) {
      block.markStale();
    }
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.filters', 'notebook.projectIds']),
      execute: investigationVersion =>
        this.transport.updateInvestigation({
          investigationVersion,
          filters: nextFilters,
          projectIds: nextProjects,
        }),
      failurePolicy: 'rollback',
      kind: 'notebook.scope',
      onCommit: detail => {
        this.filters = detail.filters;
        this.projectIds = detail.projectIds;
        this.applyRemoteSnapshot(detail);
      },
      onRollback: () => {
        if (this.filters === nextFilters) {
          this.filters = previousFilters;
        }
        if (this.projectIds === nextProjects) {
          this.projectIds = previousProjects;
        }
      },
    }).then(() => {});
  }

  editParameterValue(key: string, value: unknown) {
    this.parameterValues = {...this.parameterValues, [key]: value};
    this.parameterErrors = validateParameters(this.parameters, this.parameterValues);
    this.parameterSaveState = Object.keys(this.parameterErrors).length
      ? 'invalid'
      : 'scheduled';
    for (const block of this.blocksInOrder) {
      block.markStale();
    }
    if (this.parameterSaveTimer) {
      this.timers.clearTimeout(this.parameterSaveTimer);
    }
    if (this.parameterSaveState === 'scheduled') {
      this.parameterSaveTimer = this.timers.setTimeout(() => {
        this.parameterSaveTimer = null;
        void this.flushParameterValues().catch(() => {});
      }, 600);
    }
  }

  async flushParameterValues(): Promise<void> {
    if (this.parameterSaveTimer) {
      this.timers.clearTimeout(this.parameterSaveTimer);
      this.parameterSaveTimer = null;
    }
    if (
      this.parameterSaveState === 'invalid' ||
      isEqual(this.parameterValues, this.confirmedParameterValues)
    ) {
      if (this.parameterSaveState !== 'invalid') {
        this.parameterSaveState = 'idle';
      }
      return;
    }
    if (this.parameterSavePromise) {
      await this.parameterSavePromise;
      if (!isEqual(this.parameterValues, this.confirmedParameterValues)) {
        await this.flushParameterValues();
      }
      return;
    }

    const sentValues = {...this.parameterValues};
    this.parameterSaveState = 'saving';
    const request = this.enqueueOperation({
      affectedFields: new Set(['notebook.parameters']),
      execute: investigationVersion =>
        this.transport.updateParameters(investigationVersion, sentValues),
      failurePolicy: 'retain-draft',
      kind: 'notebook.parameters',
      onCommit: detail => {
        this.parameters = detail.parameters;
        this.confirmedParameterValues = parameterValues(detail.parameters);
        this.version = Math.max(this.version, detail.version);
        if (isEqual(this.parameterValues, sentValues)) {
          this.parameterValues = this.confirmedParameterValues;
          this.parameterErrors = validateParameters(
            this.parameters,
            this.parameterValues
          );
          this.parameterSaveState = 'idle';
        } else {
          this.parameterSaveState = 'scheduled';
        }
      },
    }).then(() => {});
    this.parameterSavePromise = request;
    try {
      await request;
    } catch (error) {
      runInAction(() => {
        this.parameterSaveState = 'unsaved';
      });
      throw error;
    } finally {
      runInAction(() => {
        this.parameterSavePromise = null;
      });
    }
    if (!isEqual(this.parameterValues, this.confirmedParameterValues)) {
      runInAction(() => {
        this.parameterSaveState = 'scheduled';
      });
      await this.flushParameterValues();
    }
  }

  updateParameterValues(values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      this.editParameterValue(key, value);
    }
    return this.flushParameterValues();
  }

  updateAccess(
    permissions: Pick<InvestigationPermissions, 'isEditableByEveryone' | 'teamIds'>
  ): Promise<void> {
    if (this.isUpdatingAccess) {
      return Promise.resolve();
    }
    const previous = this.permissions;
    const next = {...this.permissions, ...permissions};
    this.permissions = next;
    this.isUpdatingAccess = true;
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.permissions']),
      execute: investigationVersion =>
        this.transport.updatePermissions(investigationVersion, permissions),
      failurePolicy: 'rollback',
      kind: 'notebook.permissions',
      onCommit: result => {
        this.permissions = result;
        this.version += 1;
      },
      onRollback: () => {
        if (this.permissions === next) {
          this.permissions = previous;
        }
      },
    })
      .then(() => {})
      .finally(() => {
        runInAction(() => {
          this.isUpdatingAccess = false;
        });
      });
  }

  archive(): Promise<void> {
    const previous = this.status;
    this.status = 'archived';
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.status']),
      execute: investigationVersion =>
        this.transport.archiveInvestigation(investigationVersion),
      failurePolicy: 'rollback',
      kind: 'notebook.archive',
      onCommit: () => {
        this.version += 1;
      },
      onRollback: () => {
        if (this.status === 'archived') {
          this.status = previous;
        }
      },
    }).then(() => {});
  }

  restoreInvestigation(): Promise<void> {
    const previous = this.status;
    this.status = 'active';
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.status']),
      execute: investigationVersion =>
        this.transport.updateInvestigation({
          investigationVersion,
          status: 'active',
        }),
      failurePolicy: 'rollback',
      kind: 'notebook.restore',
      onCommit: detail => this.applyRemoteSnapshot(detail),
      onRollback: () => {
        if (this.status === 'active') {
          this.status = previous;
        }
      },
    }).then(() => {});
  }

  insertBlock(kind: 'query' | 'text', index: number): Promise<void> {
    const clientKey = `optimistic-block-${this.idGenerator()}`;
    const optimistic = new BlockStore(
      this,
      {
        id: clientKey,
        position: index,
        kind,
        title: '',
        content: '',
        currentExecution: null,
        generationPrompt: '',
        generatedContent: '',
        output: null,
        outputStatus: 'notRun',
        config: {optimisticKey: clientKey},
        display: {type: kind === 'text' ? 'markdown' : 'table'},
        dependencies: [],
        parameterKeys: [],
        version: 0,
        staleAt: null,
        createdBy: null,
        lastEditedBy: null,
        reactions: [],
        commentCount: 0,
      },
      clientKey
    );
    const previousKeys = [...this.blockKeys];
    this.blocks.set(clientKey, optimistic);
    this.blockKeys = [
      ...this.blockKeys.slice(0, index),
      clientKey,
      ...this.blockKeys.slice(index),
    ];
    this.updateBlockPositions();

    const creation = this.enqueueOperation({
      affectedFields: new Set([`${clientKey}.created`]),
      execute: investigationVersion =>
        this.transport.createBlock({
          investigationVersion,
          kind,
          display: optimistic.display,
        }),
      failurePolicy: 'rollback',
      kind: 'block.create',
      onCommit: block => {
        optimistic.attachServerId(block.id);
        optimistic.applyServerSnapshot({
          ...block,
          position: optimistic.position,
        });
        this.version += 1;
      },
      onRollback: () => {
        if (this.blocks.get(clientKey) === optimistic) {
          optimistic.dispose();
          this.blocks.delete(clientKey);
          this.blockKeys = previousKeys;
          this.updateBlockPositions();
        }
      },
    }).then(() => {});
    this.blockCreationPromises.set(clientKey, creation);
    return creation
      .then(async () => {
        this.blockCreationPromises.delete(clientKey);
        if (index < previousKeys.length) {
          await this.persistBlockOrder();
        }
      })
      .finally(() => {
        this.blockCreationPromises.delete(clientKey);
      });
  }

  deleteBlock(clientKey: string): Promise<void> {
    const block = this.blocks.get(clientKey);
    if (!block?.serverId) {
      return Promise.resolve();
    }
    const previousIndex = this.blockKeys.indexOf(clientKey);
    const serverId = block.serverId;
    const version = block.version;
    block.markDeleted();
    this.blockKeys = this.blockKeys.filter(key => key !== clientKey);
    this.updateBlockPositions();
    return this.enqueueOperation({
      affectedFields: new Set([`${clientKey}.deleted`]),
      execute: investigationVersion =>
        this.transport.deleteBlock(serverId, {investigationVersion, version}),
      failurePolicy: 'rollback',
      kind: 'block.delete',
      onCommit: () => {
        this.version += 1;
        block.dispose();
        this.blocks.delete(clientKey);
      },
      onRollback: () => {
        if (block.isDeleted) {
          block.restore();
          this.blockKeys = [
            ...this.blockKeys.slice(0, previousIndex),
            clientKey,
            ...this.blockKeys.slice(previousIndex),
          ];
          this.updateBlockPositions();
        }
      },
    }).then(() => {});
  }

  moveBlock(activeKey: string, overKey: string): Promise<void> {
    const oldIndex = this.blockKeys.indexOf(activeKey);
    const newIndex = this.blockKeys.indexOf(overKey);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return Promise.resolve();
    }
    const previous = [...this.blockKeys];
    const next = [...this.blockKeys];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved!);
    this.blockKeys = next;
    this.updateBlockPositions();
    return this.persistBlockOrder(() => {
      if (this.blockKeys === next) {
        this.blockKeys = previous;
        this.updateBlockPositions();
      }
    });
  }

  async reloadLatest(): Promise<void> {
    const operation = this.conflictedOperation;
    const detail = await this.transport.loadDetail();
    runInAction(() => {
      if (operation?.failurePolicy === 'rollback') {
        operation.onRollback?.();
      }
      if (operation) {
        this.pendingOperations.delete(operation.id);
      }
      this.conflictedOperation = null;
      this.conflict = null;
      this.applyRemoteSnapshot(detail);
    });
  }

  async retryChange(): Promise<void> {
    const operation = this.conflictedOperation;
    if (!operation) {
      return;
    }
    const detail = await this.transport.loadDetail();
    runInAction(() => {
      this.applyRemoteSnapshot(detail);
      this.conflict = null;
      operation.state = 'queued';
    });
    await this.executeOperation(operation);
  }

  dispose() {
    this.disposed = true;
    if (this.parameterSaveTimer) {
      this.timers.clearTimeout(this.parameterSaveTimer);
      this.parameterSaveTimer = null;
    }
    if (this.executionPollTimer) {
      this.timers.clearInterval(this.executionPollTimer);
      this.executionPollTimer = null;
    }
    for (const block of this.blocks.values()) {
      block.dispose();
    }
    this.appliedRemoteEventIds.clear();
  }

  private applyRemoteParameters(parameters: InvestigationParameter[]) {
    const incomingValues = parameterValues(parameters);
    this.parameters = parameters;
    this.confirmedParameterValues = incomingValues;
    if (this.parameterSaveState === 'idle') {
      this.parameterValues = incomingValues;
    }
    this.parameterErrors = validateParameters(this.parameters, this.parameterValues);
    if (Object.keys(this.parameterErrors).length) {
      this.parameterSaveState = 'invalid';
    }
  }

  private findPendingOperation(fields: string[]): NotebookOperation | null {
    return (
      [...this.pendingOperations.values()].find(operation =>
        [...operation.affectedFields].some(affected =>
          fields.some(
            field =>
              affected === field ||
              affected.startsWith(field) ||
              field.startsWith(affected)
          )
        )
      ) ?? null
    );
  }

  private enterRemoteConflict(operation: NotebookOperation | null, eventId: string) {
    if (operation) {
      operation.state = 'conflicted';
      this.conflictedOperation = operation;
    }
    this.conflict = {
      operationId: operation?.id ?? eventId,
      operationKind: operation?.kind ?? 'remote_conflict',
    };
  }

  private syncExecutionPolling() {
    if (this.disposed || !this.hasPendingExecution) {
      if (this.executionPollTimer) {
        this.timers.clearInterval(this.executionPollTimer);
        this.executionPollTimer = null;
      }
      return;
    }
    if (this.executionPollTimer) {
      return;
    }
    this.executionPollTimer = this.timers.setInterval(() => {
      const active = this.blocksInOrder.filter(
        block => block.isExecutionRunning && block.serverId && block.currentExecution
      );
      void Promise.all(
        active.map(async block => {
          const state = await this.transport.loadBlockExecution(
            block.serverId!,
            block.currentExecution!.id
          );
          runInAction(() => block.applyExecutionState(state));
          if (['completed', 'failed', 'canblocked'].includes(state.status)) {
            await this.refreshDetail();
          }
        })
      )
        .then(async () => {
          if (this.isTitleGenerating) {
            const title = await this.transport.loadTitleGeneration();
            runInAction(() => {
              this.titleGenerationStatus = title.status;
              this.titleGenerationPreview = title.preview;
            });
            if (title.status !== 'pending' && title.status !== 'running') {
              await this.refreshDetail();
            }
          }
        })
        .catch(() => {});
    }, 1500);
  }

  toSnapshot(): NotebookStoreSnapshot {
    return {
      investigationId: this.investigationId,
      organizationSlug: this.organizationSlug,
      loadState: this.loadState,
      lastRemoteEventSequence: this.lastRemoteEventSequence,
      parameterValues: {...this.parameterValues},
      parameterSaveState: this.parameterSaveState,
      title: this.title,
      version: this.version,
      filters: this.filters,
      projectIds: [...this.projectIds],
      blockKeys: [...this.blockKeys],
      blocks: this.blocksInOrder.map(block => block.toSnapshot()),
      isSaving: this.isSaving,
      conflict: this.conflict,
    };
  }

  findBlockByServerId(serverId: string): BlockStore | undefined {
    return [...this.blocks.values()].find(block => block.serverId === serverId);
  }

  private persistBlockOrder(onRollback?: () => void): Promise<void> {
    const unresolved = this.blockKeys
      .map(key => this.blockCreationPromises.get(key))
      .filter((promise): promise is Promise<void> => promise !== undefined);
    if (unresolved.length > 0) {
      return Promise.all(unresolved).then(() => this.persistBlockOrder(onRollback));
    }
    const serverIds = this.blockKeys.map(key => this.blocks.get(key)?.serverId);
    if (serverIds.some(id => id === null || id === undefined)) {
      return Promise.reject(new Error('All blocks must be persisted before reordering.'));
    }
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.blockOrder']),
      execute: investigationVersion =>
        this.transport.reorderBlocks({
          investigationVersion,
          blockIds: serverIds as string[],
        }),
      failurePolicy: 'rollback',
      kind: 'block.reorder',
      onCommit: detail => this.applyRemoteSnapshot(detail),
      onRollback,
    }).then(() => {});
  }

  private updateBlockPositions() {
    this.blockKeys.forEach((key, position) => {
      const block = this.blocks.get(key);
      if (block) {
        block.position = position;
      }
    });
  }

  private async executeOperation<T>(operation: NotebookOperation<T>): Promise<T> {
    runInAction(() => {
      operation.state = 'running';
      this.mutationError = null;
    });
    try {
      const result = await operation.execute(this.version);
      runInAction(() => {
        operation.onCommit(result);
        this.pendingOperations.delete(operation.id);
        if (this.conflictedOperation?.id === operation.id) {
          this.conflictedOperation = null;
          this.conflict = null;
        }
      });
      return result;
    } catch (error) {
      let reconciliation: InvestigationDetail | null = null;
      const isAmbiguousFailure =
        error instanceof RequestError &&
        (error.status === undefined || error.status === 0 || error.status >= 500);
      if (isAmbiguousFailure) {
        runInAction(() => {
          this.mutationError = 'reconciling';
        });
        try {
          reconciliation = await this.transport.loadDetail();
        } catch {
          reconciliation = null;
        }
      }
      runInAction(() => {
        if (error instanceof RequestError && error.status === 409) {
          operation.state = 'conflicted';
          this.conflictedOperation = operation as NotebookOperation;
          this.conflict = {
            operationId: operation.id,
            operationKind: operation.kind,
          };
          return;
        }

        operation.state = 'failed';
        this.pendingOperations.delete(operation.id);
        if (reconciliation) {
          this.applyRemoteSnapshot(reconciliation);
        }
        this.mutationError =
          operation.failurePolicy === 'retain-draft' ? 'unsaved' : 'mutation_failed';
        if (operation.failurePolicy === 'rollback' && !reconciliation) {
          operation.onRollback?.();
        }
      });
      throw error;
    }
  }
}

function parameterValues(parameters: InvestigationParameter[]): Record<string, unknown> {
  return Object.fromEntries(
    parameters.map(parameter => [
      parameter.key,
      parameter.savedValue ?? parameter.defaultValue,
    ])
  );
}

function validateParameters(
  parameters: InvestigationParameter[],
  values: Record<string, unknown>
): Record<string, ParameterValidationError> {
  return Object.fromEntries(
    parameters.flatMap(parameter => {
      const error = validateParameter(parameter, values[parameter.key]);
      return error ? [[parameter.key, error]] : [];
    })
  );
}

function validateParameter(
  parameter: InvestigationParameter,
  value: unknown
): ParameterValidationError | null {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  if (empty) {
    return parameter.required ? {code: 'required'} : null;
  }

  const min = numericConstraint(parameter.constraints.min);
  const max = numericConstraint(parameter.constraints.max);
  if (parameter.type === 'string') {
    const maxLength = numericConstraint(parameter.constraints.maxLength);
    if (typeof value !== 'string') {
      return {code: 'text'};
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return {code: 'max_length', limit: maxLength};
    }
  }
  if (parameter.type === 'number' || parameter.type === 'duration') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {code: 'number'};
    }
    if (parameter.type === 'duration' && !Number.isInteger(value)) {
      return {code: 'integer_seconds'};
    }
    if (min !== undefined && value < min) {
      return {code: 'min', limit: min};
    }
    if (max !== undefined && value > max) {
      return {code: 'max', limit: max};
    }
  }
  if (
    parameter.type === 'enum' &&
    (!Array.isArray(parameter.constraints.options) ||
      !parameter.constraints.options.includes(value))
  ) {
    return {code: 'enum'};
  }
  if (parameter.type === 'datetime_range') {
    const range = asDateRange(value);
    const start = range.start ? new Date(range.start) : null;
    const end = range.end ? new Date(range.end) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return {code: 'date_range'};
    }
    if (start >= end) {
      return {code: 'date_order'};
    }
    const maxDays = numericConstraint(parameter.constraints.maxDays);
    if (maxDays !== undefined && end.getTime() - start.getTime() > maxDays * 86_400_000) {
      return {code: 'max_days', limit: maxDays};
    }
  }
  if (parameter.type === 'environment_list' && Array.isArray(value)) {
    if (new Set(value).size !== value.length) {
      return {code: 'duplicate_environments'};
    }
    const maxItems = numericConstraint(parameter.constraints.maxItems);
    if (maxItems !== undefined && value.length > maxItems) {
      return {code: 'max_environments', limit: maxItems};
    }
  }
  if (
    parameter.type === 'project_list' &&
    Array.isArray(value) &&
    new Set(value).size !== value.length
  ) {
    return {code: 'duplicate_projects'};
  }
  return null;
}

function asDateRange(value: unknown): {end?: string; start?: string} {
  return typeof value === 'object' && value !== null ? value : {};
}

function numericConstraint(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
