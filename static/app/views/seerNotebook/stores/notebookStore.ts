import isEqual from 'lodash/isEqual';
import {action, computed, makeObservable, observable, runInAction} from 'mobx';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {CellStore} from 'sentry/views/seerNotebook/stores/cellStore';
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
  source: InvestigationDetail['source'] = {type: '', ref: {}};
  template: InvestigationDetail['template'] = null;
  dateCreated = '';
  dateUpdated = '';
  createdBy: string | null = null;
  isFavorited = false;
  isUpdatingFavorite = false;
  cellCount = 0;
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
  cellKeys: string[] = [];
  cells = new Map<string, CellStore>();
  pendingOperations = new Map<string, NotebookOperation>();
  titleDirty = false;
  titleGenerationStatus: string | null = null;
  titleGenerationPreview: string | null = null;
  lastRemoteEventSequence = -1;

  private readonly idGenerator: () => string;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private conflictedOperation: NotebookOperation | null = null;
  private cellCreationPromises = new Map<string, Promise<void>>();
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
      cellCount: observable,
      filters: observable.ref,
      projectIds: observable.shallow,
      parameters: observable.shallow,
      parameterValues: observable.ref,
      parameterErrors: observable.ref,
      parameterSaveState: observable,
      isUpdatingAccess: observable,
      permissions: observable.ref,
      version: observable,
      cellKeys: observable.shallow,
      cells: observable.shallow,
      pendingOperations: observable.shallow,
      titleDirty: observable,
      titleGenerationStatus: observable,
      titleGenerationPreview: observable,
      lastRemoteEventSequence: observable,
      cellsInOrder: computed,
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
      runCell: action,
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
      insertCell: action,
      deleteCell: action,
      moveCell: action,
    });
  }

  get cellsInOrder(): CellStore[] {
    return this.cellKeys
      .map(key => this.cells.get(key))
      .filter((cell): cell is CellStore => cell !== undefined && !cell.isDeleted);
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
      cellCount: this.cellsInOrder.length,
      filters: this.filters,
      projectIds: this.projectIds,
      parameters: this.parameters,
      permissions: this.permissions,
      version: this.version,
      cells: this.cellsInOrder.map(cell => cell.toInvestigationCell()),
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
      this.isTitleGenerating || this.cellsInOrder.some(cell => cell.isExecutionRunning)
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
    this.cellCount = detail.cellCount;
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
    const incomingServerIds = new Set(detail.cells.map(cell => cell.id));
    for (const incoming of detail.cells) {
      const existing = this.findCellByServerId(incoming.id);
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
        const cell = new CellStore(this, incoming);
        this.cells.set(cell.clientKey, cell);
        nextKeys.push(cell.clientKey);
      }
    }

    for (const key of this.cellKeys) {
      const cell = this.cells.get(key);
      if (!cell?.serverId) {
        if (cell && !nextKeys.includes(key)) {
          nextKeys.push(key);
        }
        continue;
      }
      if (cell.isDeleted) {
        if (this.findPendingOperation([`${cell.clientKey}.deleted`])) {
          if (!nextKeys.includes(key)) {
            nextKeys.push(key);
          }
        } else {
          cell.dispose();
          this.cells.delete(key);
        }
        continue;
      }
      if (!incomingServerIds.has(cell.serverId) && !cell.isDirty) {
        cell.dispose();
        this.cells.delete(key);
      }
    }
    this.cellKeys = nextKeys;
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

    if (event.kind === 'cells.reordered') {
      const operation = this.findPendingOperation(['notebook.cellOrder']);
      if (operation && event.clientMutationId !== operation.id) {
        this.enterRemoteConflict(operation, event.eventId);
        return;
      }
      const ordered = event.cellIds.flatMap(id => {
        const cell = this.findCellByServerId(id);
        return cell ? [cell.clientKey] : [];
      });
      const unmentioned = this.cellKeys.filter(key => !ordered.includes(key));
      this.cellKeys = [...ordered, ...unmentioned];
      this.updateCellPositions();
      return;
    }

    let cell = this.findCellByServerId(event.cellId);
    if (event.kind === 'cell.upserted') {
      if (!cell && acknowledgedOperation?.kind === 'cell.create') {
        const clientKey = [...acknowledgedOperation.affectedFields]
          .find(field => field.endsWith('.created'))
          ?.slice(0, -'.created'.length);
        cell = clientKey ? this.cells.get(clientKey) : undefined;
        cell?.attachServerId(event.cellId);
      }
      if (cell?.isDeleted) {
        return;
      }
      const conflicts = cell?.getConflictingDirtyFields(event.payload) ?? [];
      if (conflicts.length) {
        const operation = this.findPendingOperation(
          conflicts.map(field => `${cell!.clientKey}.${field}`)
        );
        this.enterRemoteConflict(operation, event.eventId);
      }
      if (cell) {
        if (acknowledgedOperation?.kind === 'cell.save') {
          cell.acknowledgeRemoteSnapshot(event.payload);
        } else {
          cell.applyServerSnapshot(event.payload);
        }
      } else {
        const inserted = new CellStore(this, event.payload);
        this.cells.set(inserted.clientKey, inserted);
        this.cellKeys = [...this.cellKeys, inserted.clientKey];
      }
      return;
    }
    if (!cell) {
      return;
    }
    if (event.kind === 'cell.deleted') {
      const operation = this.findPendingOperation([`${cell.clientKey}.`]);
      if (cell.isDirty || operation) {
        this.enterRemoteConflict(operation, event.eventId);
        return;
      }
      cell.dispose();
      this.cells.delete(cell.clientKey);
      this.cellKeys = this.cellKeys.filter(key => key !== cell.clientKey);
      return;
    }
    if (event.kind === 'execution.updated') {
      cell.applyExecutionUpdate(event.payload);
      this.syncExecutionPolling();
      return;
    }
    if (event.kind === 'comment.upserted') {
      cell.applyRemoteComment(event.comment);
      return;
    }
    if (event.kind === 'comment.deleted') {
      cell.removeRemoteComment(event.commentId);
      return;
    }
    if (event.kind === 'cell.reactions.updated') {
      cell.applyRemoteReactions(event.payload);
      return;
    }
    if (event.kind === 'comment.reactions.updated') {
      cell.applyRemoteCommentReactions(event.commentId, event.payload);
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

  saveCell(cell: CellStore): Promise<void> {
    if (!cell.serverId) {
      const creation = this.cellCreationPromises.get(cell.clientKey);
      if (!creation) {
        return Promise.reject(
          new Error('The cell must be created before it can be saved.')
        );
      }
      return creation.then(() => this.saveCell(cell));
    }
    const {fields, values} = cell.getPendingSave();
    if (fields.length === 0) {
      return Promise.resolve();
    }
    cell.markSaveStarted();
    const serverId = cell.serverId;
    return this.enqueueOperation({
      affectedFields: new Set(fields.map(field => `${cell.clientKey}.${field}`)),
      execute: investigationVersion =>
        this.transport.updateCell(serverId, {
          investigationVersion,
          version: cell.version,
          ...values,
        }),
      failurePolicy: 'retain-draft',
      kind: 'cell.save',
      onCommit: result => {
        this.version += 1;
        cell.confirmSave(result, fields, values);
      },
    })
      .then(() => {})
      .catch(error => {
        cell.failSave();
        throw error;
      });
  }

  async runCell(cell: CellStore, options: {retry: boolean}): Promise<void> {
    if (
      this.isReadOnly ||
      !this.queryExecutionEnabled ||
      cell.isExecutionRunning ||
      !cell.executionIntent.trim()
    ) {
      return;
    }
    const requestId =
      options.retry && cell.failedRunRequestId
        ? cell.failedRunRequestId
        : this.idGenerator();
    cell.beginRunRequest(requestId);
    try {
      await cell.flush();
      if (!cell.serverId) {
        throw new Error('The cell must be persisted before it can run.');
      }
      runInAction(() => cell.markExecutionPending());
      const result = await this.transport.executeCell(cell.serverId, {
        investigationVersion: this.version,
        requestId,
        version: cell.version,
      });
      runInAction(() => {
        cell.markExecutionAccepted(result);
        this.syncExecutionPolling();
      });
    } catch (error) {
      runInAction(() => cell.failRunRequest(requestId));
      throw error;
    } finally {
      runInAction(() => cell.finishRunRequest(requestId));
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
    for (const cell of this.cellsInOrder) {
      cell.markStale();
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
    for (const cell of this.cellsInOrder) {
      cell.markStale();
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

  insertCell(kind: 'query' | 'text', index: number): Promise<void> {
    const clientKey = `optimistic-cell-${this.idGenerator()}`;
    const optimistic = new CellStore(
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
    const previousKeys = [...this.cellKeys];
    this.cells.set(clientKey, optimistic);
    this.cellKeys = [
      ...this.cellKeys.slice(0, index),
      clientKey,
      ...this.cellKeys.slice(index),
    ];
    this.updateCellPositions();

    const creation = this.enqueueOperation({
      affectedFields: new Set([`${clientKey}.created`]),
      execute: investigationVersion =>
        this.transport.createCell({
          investigationVersion,
          kind,
          display: optimistic.display,
        }),
      failurePolicy: 'rollback',
      kind: 'cell.create',
      onCommit: cell => {
        optimistic.attachServerId(cell.id);
        optimistic.applyServerSnapshot({
          ...cell,
          position: optimistic.position,
        });
        this.version += 1;
      },
      onRollback: () => {
        if (this.cells.get(clientKey) === optimistic) {
          optimistic.dispose();
          this.cells.delete(clientKey);
          this.cellKeys = previousKeys;
          this.updateCellPositions();
        }
      },
    }).then(() => {});
    this.cellCreationPromises.set(clientKey, creation);
    return creation
      .then(async () => {
        this.cellCreationPromises.delete(clientKey);
        if (index < previousKeys.length) {
          await this.persistCellOrder();
        }
      })
      .finally(() => {
        this.cellCreationPromises.delete(clientKey);
      });
  }

  deleteCell(clientKey: string): Promise<void> {
    const cell = this.cells.get(clientKey);
    if (!cell?.serverId) {
      return Promise.resolve();
    }
    const previousIndex = this.cellKeys.indexOf(clientKey);
    const serverId = cell.serverId;
    const version = cell.version;
    cell.markDeleted();
    this.cellKeys = this.cellKeys.filter(key => key !== clientKey);
    this.updateCellPositions();
    return this.enqueueOperation({
      affectedFields: new Set([`${clientKey}.deleted`]),
      execute: investigationVersion =>
        this.transport.deleteCell(serverId, {investigationVersion, version}),
      failurePolicy: 'rollback',
      kind: 'cell.delete',
      onCommit: () => {
        this.version += 1;
        cell.dispose();
        this.cells.delete(clientKey);
      },
      onRollback: () => {
        if (cell.isDeleted) {
          cell.restore();
          this.cellKeys = [
            ...this.cellKeys.slice(0, previousIndex),
            clientKey,
            ...this.cellKeys.slice(previousIndex),
          ];
          this.updateCellPositions();
        }
      },
    }).then(() => {});
  }

  moveCell(activeKey: string, overKey: string): Promise<void> {
    const oldIndex = this.cellKeys.indexOf(activeKey);
    const newIndex = this.cellKeys.indexOf(overKey);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return Promise.resolve();
    }
    const previous = [...this.cellKeys];
    const next = [...this.cellKeys];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved!);
    this.cellKeys = next;
    this.updateCellPositions();
    return this.persistCellOrder(() => {
      if (this.cellKeys === next) {
        this.cellKeys = previous;
        this.updateCellPositions();
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
    for (const cell of this.cells.values()) {
      cell.dispose();
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
      const active = this.cellsInOrder.filter(
        cell => cell.isExecutionRunning && cell.serverId && cell.currentExecution
      );
      void Promise.all(
        active.map(async cell => {
          const state = await this.transport.loadCellExecution(
            cell.serverId!,
            cell.currentExecution!.id
          );
          runInAction(() => cell.applyExecutionState(state));
          if (['completed', 'failed', 'cancelled'].includes(state.status)) {
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
      cellKeys: [...this.cellKeys],
      cells: this.cellsInOrder.map(cell => cell.toSnapshot()),
      isSaving: this.isSaving,
      conflict: this.conflict,
    };
  }

  findCellByServerId(serverId: string): CellStore | undefined {
    return [...this.cells.values()].find(cell => cell.serverId === serverId);
  }

  private persistCellOrder(onRollback?: () => void): Promise<void> {
    const unresolved = this.cellKeys
      .map(key => this.cellCreationPromises.get(key))
      .filter((promise): promise is Promise<void> => promise !== undefined);
    if (unresolved.length > 0) {
      return Promise.all(unresolved).then(() => this.persistCellOrder(onRollback));
    }
    const serverIds = this.cellKeys.map(key => this.cells.get(key)?.serverId);
    if (serverIds.some(id => id === null || id === undefined)) {
      return Promise.reject(new Error('All cells must be persisted before reordering.'));
    }
    return this.enqueueOperation({
      affectedFields: new Set(['notebook.cellOrder']),
      execute: investigationVersion =>
        this.transport.reorderCells({
          investigationVersion,
          cellIds: serverIds as string[],
        }),
      failurePolicy: 'rollback',
      kind: 'cell.reorder',
      onCommit: detail => this.applyRemoteSnapshot(detail),
      onRollback,
    }).then(() => {});
  }

  private updateCellPositions() {
    this.cellKeys.forEach((key, position) => {
      const cell = this.cells.get(key);
      if (cell) {
        cell.position = position;
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
