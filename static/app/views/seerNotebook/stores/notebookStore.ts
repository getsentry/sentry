import {action, computed, makeObservable, observable, runInAction} from 'mobx';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {CellStore} from 'sentry/views/seerNotebook/stores/cellStore';
import type {
  InvestigationTransport,
  NotebookConflict,
  NotebookOperation,
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
  cellCount = 0;
  filters: InvestigationFilters = {};
  projectIds: number[] = [];
  parameters: InvestigationParameter[] = [];
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

  private readonly idGenerator: () => string;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private conflictedOperation: NotebookOperation | null = null;
  private disposed = false;

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
      cellCount: observable,
      filters: observable.ref,
      projectIds: observable.shallow,
      parameters: observable.shallow,
      permissions: observable.ref,
      version: observable,
      cellKeys: observable.shallow,
      cells: observable.shallow,
      pendingOperations: observable.shallow,
      cellsInOrder: computed,
      isReadOnly: computed,
      isSaving: computed,
      canExecuteQueries: computed,
      load: action,
      retryLoad: action,
      applyRemoteSnapshot: action,
      dispose: action,
      reloadLatest: action,
      retryChange: action,
    });
  }

  get cellsInOrder(): CellStore[] {
    return this.cellKeys
      .map(key => this.cells.get(key))
      .filter((cell): cell is CellStore => cell !== undefined && !cell.isDeleted);
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

  applyRemoteSnapshot(detail: InvestigationDetail) {
    if (this.disposed) {
      return;
    }

    this.title = detail.title;
    if (!this.titleDraft) {
      this.titleDraft = detail.title;
    }
    this.status = detail.status;
    this.sourceType = detail.sourceType;
    this.source = detail.source;
    this.template = detail.template;
    this.dateCreated = detail.dateCreated;
    this.dateUpdated = detail.dateUpdated;
    this.createdBy = detail.createdBy;
    this.isFavorited = detail.isFavorited;
    this.cellCount = detail.cellCount;
    this.filters = detail.filters;
    this.projectIds = detail.projectIds;
    this.parameters = detail.parameters;
    this.permissions = detail.permissions;
    this.version = Math.max(this.version, detail.version);

    const nextKeys: string[] = [];
    const incomingServerIds = new Set(detail.cells.map(cell => cell.id));
    for (const incoming of detail.cells) {
      const existing = this.findCellByServerId(incoming.id);
      if (existing) {
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
      if (!cell || cell.isDeleted || cell.serverId === null) {
        if (cell && !nextKeys.includes(key)) {
          nextKeys.push(key);
        }
        continue;
      }
      if (!incomingServerIds.has(cell.serverId) && !cell.isDirty) {
        this.cells.delete(key);
      }
    }
    this.cellKeys = nextKeys;
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
  }

  toSnapshot(): NotebookStoreSnapshot {
    return {
      investigationId: this.investigationId,
      organizationSlug: this.organizationSlug,
      loadState: this.loadState,
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
        this.mutationError =
          operation.failurePolicy === 'retain-draft' ? 'unsaved' : 'mutation_failed';
        if (operation.failurePolicy === 'rollback') {
          operation.onRollback?.();
        }
        this.pendingOperations.delete(operation.id);
      });
      throw error;
    }
  }
}
