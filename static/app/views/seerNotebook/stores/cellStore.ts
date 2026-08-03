import isEqual from 'lodash/isEqual';
import {action, computed, makeObservable, observable} from 'mobx';

import type {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import type {
  InvestigationCell,
  InvestigationCellExecution,
  InvestigationDisplay,
  InvestigationReaction,
} from 'sentry/views/seerNotebook/types';

const EDITABLE_FIELDS = ['content', 'display', 'generationPrompt', 'title'] as const;
export type CellEditableField = (typeof EDITABLE_FIELDS)[number];

type ConfirmedCellFields = Pick<
  InvestigationCell,
  CellEditableField | 'position' | 'version'
>;

export type CellStoreSnapshot = InvestigationCell & {
  clientKey: string;
  dirtyFields: CellEditableField[];
  saveState: CellSaveState;
};

export type CellSaveState = 'idle' | 'scheduled' | 'saving' | 'unsaved';

export class CellStore {
  readonly clientKey: string;
  readonly notebook: NotebookStore;

  serverId: string | null;
  position: number;
  kind: InvestigationCell['kind'];
  title: string;
  content: string;
  generationPrompt: string;
  generatedContent: string;
  config: Record<string, unknown>;
  display: InvestigationDisplay;
  dependencies: string[];
  parameterKeys: string[];
  version: number;
  staleAt: string | null;
  output: InvestigationCell['output'];
  outputStatus: string;
  currentExecution: InvestigationCellExecution | null;
  createdBy: string | null;
  lastEditedBy: string | null;
  reactions: InvestigationReaction[];
  commentCount: number;
  isDeleted = false;
  dirtyFields = new Set<CellEditableField>();
  saveError: string | null = null;
  saveState: CellSaveState = 'idle';
  isRunRequested = false;

  private confirmed: ConfirmedCellFields;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savePromise: Promise<void> | null = null;
  private disposed = false;

  constructor(notebook: NotebookStore, cell: InvestigationCell, clientKey = cell.id) {
    this.notebook = notebook;
    this.clientKey = clientKey;
    this.serverId = cell.id.startsWith('optimistic-cell-') ? null : cell.id;
    this.position = cell.position;
    this.kind = cell.kind;
    this.title = cell.title;
    this.content = cell.content;
    this.generationPrompt = cell.generationPrompt;
    this.generatedContent = cell.generatedContent;
    this.config = cell.config;
    this.display = cell.display;
    this.dependencies = cell.dependencies;
    this.parameterKeys = cell.parameterKeys;
    this.version = cell.version;
    this.staleAt = cell.staleAt;
    this.output = cell.output;
    this.outputStatus = cell.outputStatus;
    this.currentExecution = cell.currentExecution ?? null;
    this.createdBy = cell.createdBy;
    this.lastEditedBy = cell.lastEditedBy;
    this.reactions = cell.reactions;
    this.commentCount = cell.commentCount;
    this.confirmed = this.confirmedFields(cell);

    makeObservable(this, {
      serverId: observable,
      position: observable,
      kind: observable,
      title: observable,
      content: observable,
      generationPrompt: observable,
      generatedContent: observable,
      config: observable.ref,
      display: observable.ref,
      dependencies: observable.shallow,
      parameterKeys: observable.shallow,
      version: observable,
      staleAt: observable,
      output: observable.ref,
      outputStatus: observable,
      currentExecution: observable.ref,
      createdBy: observable,
      lastEditedBy: observable,
      reactions: observable.shallow,
      commentCount: observable,
      isDeleted: observable,
      dirtyFields: observable.shallow,
      saveError: observable,
      saveState: observable,
      isRunRequested: observable,
      isPersisted: computed,
      isDirty: computed,
      queryIntent: computed,
      executionIntent: computed,
      executionHasChanged: computed,
      isExecutionRunning: computed,
      editTitle: action,
      editContent: action,
      editGenerationPrompt: action,
      updateDisplay: action,
      applySlashCommand: action,
      clearQueryIntent: action,
      applyDraft: action,
      changeCommentCount: action,
      markExecutionAccepted: action,
      setRunRequested: action,
      markSaveStarted: action,
      confirmSave: action,
      failSave: action,
      applyServerSnapshot: action,
      attachServerId: action,
      markDeleted: action,
      markStale: action,
      restore: action,
      dispose: action,
    });
  }

  get isPersisted(): boolean {
    return this.serverId !== null;
  }

  get isDirty(): boolean {
    return this.dirtyFields.size > 0;
  }

  get queryIntent(): string {
    return this.generationPrompt || this.content;
  }

  get executionIntent(): string {
    return this.kind === 'query' ? this.queryIntent : this.generationPrompt;
  }

  get executionHasChanged(): boolean {
    const confirmedIntent =
      this.kind === 'query'
        ? this.confirmed.generationPrompt || this.confirmed.content
        : this.confirmed.generationPrompt;
    return Boolean(this.staleAt) || this.executionIntent !== confirmedIntent;
  }

  get isExecutionRunning(): boolean {
    return ['pending', 'running'].includes(this.outputStatus);
  }

  editTitle(value: string) {
    this.setEditableField('title', value, 600);
  }

  editContent(value: string) {
    this.setEditableField('content', value, 600);
  }

  editGenerationPrompt(value: string) {
    this.setEditableField('generationPrompt', value, 600);
  }

  updateDisplay(value: InvestigationDisplay) {
    this.setEditableField('display', value, 400);
  }

  clearQueryIntent() {
    this.content = '';
    this.generationPrompt = '';
    this.markDirty('content');
    this.markDirty('generationPrompt');
    this.scheduleSave(600);
  }

  applySlashCommand(prefix: string) {
    const lines = this.content.split('\n');
    lines[lines.length - 1] = prefix;
    this.editContent(lines.join('\n'));
  }

  applyDraft(values: {
    content: string;
    display: InvestigationDisplay;
    generationPrompt: string;
    title: string;
  }) {
    const clearsLegacyQuery =
      this.kind === 'query' &&
      values.content === '' &&
      values.generationPrompt === '' &&
      Boolean(
        this.content ||
        this.generationPrompt ||
        this.confirmed.content ||
        this.confirmed.generationPrompt
      );
    this.editTitle(values.title);
    if (clearsLegacyQuery) {
      this.content = '';
      this.generationPrompt = '';
      this.dirtyFields.add('content');
      this.dirtyFields.add('generationPrompt');
      this.scheduleSave(600);
    } else {
      this.editContent(values.content);
      this.editGenerationPrompt(values.generationPrompt);
    }
    this.updateDisplay(values.display);
  }

  changeCommentCount(delta: number) {
    this.commentCount = Math.max(0, this.commentCount + delta);
  }

  setRunRequested(value: boolean) {
    this.isRunRequested = value;
  }

  markExecutionAccepted(execution: {id: string; status: string}) {
    this.outputStatus = execution.status;
    this.currentExecution = {
      id: execution.id,
      status: execution.status,
      executor: this.currentExecution?.executor ?? '',
      schemaVersion: this.currentExecution?.schemaVersion ?? 1,
      startedAt: this.currentExecution?.startedAt ?? null,
      completedAt: null,
      error: null,
    };
  }

  run(): Promise<void> {
    return this.notebook.runCell(this);
  }

  async flush(): Promise<void> {
    if (this.disposed || !this.isDirty) {
      return;
    }
    this.cancelScheduledSave();
    if (this.savePromise) {
      await this.savePromise;
      if (this.isDirty) {
        await this.flush();
      }
      return;
    }

    const request = this.notebook.saveCell(this);
    this.savePromise = request;
    try {
      await request;
    } finally {
      this.savePromise = null;
    }
    if (this.isDirty && this.saveState !== 'unsaved') {
      await this.flush();
    }
  }

  getPendingSave() {
    const fields = [...this.dirtyFields];
    return {
      fields,
      values: Object.fromEntries(fields.map(field => [field, this[field]])) as Partial<
        Pick<InvestigationCell, CellEditableField>
      >,
    };
  }

  markSaveStarted() {
    this.saveState = 'saving';
    this.saveError = null;
  }

  confirmSave(
    cell: InvestigationCell,
    fields: CellEditableField[],
    sentValues: Partial<Pick<InvestigationCell, CellEditableField>>
  ) {
    const currentValues = Object.fromEntries(
      EDITABLE_FIELDS.map(field => [field, this[field]])
    ) as Pick<InvestigationCell, CellEditableField>;

    this.confirmed = this.confirmedFields(cell);
    for (const field of fields) {
      if (isEqual(currentValues[field], sentValues[field])) {
        this.dirtyFields.delete(field);
        this[field] = cell[field] as never;
      }
    }
    this.applyNonEditableServerFields(cell);
    this.saveState = this.isDirty ? 'scheduled' : 'idle';
    this.saveError = null;
  }

  failSave() {
    this.saveState = 'unsaved';
    this.saveError = 'save_failed';
  }

  attachServerId(serverId: string) {
    this.serverId = serverId;
  }

  markDeleted() {
    this.isDeleted = true;
  }

  markStale() {
    this.staleAt ??= 'optimistic';
  }

  restore() {
    this.isDeleted = false;
  }

  applyServerSnapshot(cell: InvestigationCell) {
    this.serverId = cell.id;
    this.position = cell.position;
    this.kind = cell.kind;
    this.applyNonEditableServerFields(cell);
    this.isDeleted = false;

    for (const field of EDITABLE_FIELDS) {
      if (!this.dirtyFields.has(field)) {
        this[field] = cell[field] as never;
      }
    }
    this.confirmed = this.confirmedFields(cell);
  }

  toInvestigationCell(): InvestigationCell {
    return {
      id: this.serverId ?? this.clientKey,
      position: this.position,
      kind: this.kind,
      title: this.title,
      content: this.content,
      generationPrompt: this.generationPrompt,
      generatedContent: this.generatedContent,
      config: this.config,
      display: this.display,
      dependencies: this.dependencies,
      parameterKeys: this.parameterKeys,
      version: this.version,
      staleAt: this.staleAt,
      output: this.output,
      outputStatus: this.outputStatus,
      currentExecution: this.currentExecution,
      createdBy: this.createdBy,
      lastEditedBy: this.lastEditedBy,
      reactions: this.reactions,
      commentCount: this.commentCount,
    };
  }

  toSnapshot(): CellStoreSnapshot {
    return {
      ...this.toInvestigationCell(),
      clientKey: this.clientKey,
      dirtyFields: [...this.dirtyFields],
      saveState: this.saveState,
    };
  }

  dispose() {
    this.disposed = true;
    this.cancelScheduledSave();
  }

  protected getConfirmedFields(): ConfirmedCellFields {
    return this.confirmed;
  }

  private confirmedFields(cell: InvestigationCell): ConfirmedCellFields {
    return {
      title: cell.title,
      content: cell.content,
      generationPrompt: cell.generationPrompt,
      display: cell.display,
      position: cell.position,
      version: cell.version,
    };
  }

  private applyNonEditableServerFields(cell: InvestigationCell) {
    this.generatedContent = cell.generatedContent;
    this.config = cell.config;
    this.dependencies = cell.dependencies;
    this.parameterKeys = cell.parameterKeys;
    this.version = cell.version;
    this.staleAt = cell.staleAt;
    this.output = cell.output;
    this.outputStatus = cell.outputStatus;
    this.currentExecution = cell.currentExecution ?? null;
    this.createdBy = cell.createdBy;
    this.lastEditedBy = cell.lastEditedBy;
    this.reactions = cell.reactions;
    this.commentCount = cell.commentCount;
  }

  private setEditableField<Field extends CellEditableField>(
    field: Field,
    value: InvestigationCell[Field],
    debounceMs: number
  ) {
    this[field] = value as never;
    this.markDirty(field);
    this.scheduleSave(debounceMs);
  }

  private markDirty(field: CellEditableField) {
    if (isEqual(this[field], this.confirmed[field])) {
      this.dirtyFields.delete(field);
    } else {
      this.dirtyFields.add(field);
    }
    this.saveError = null;
    this.saveState = this.isDirty ? 'scheduled' : 'idle';
  }

  private scheduleSave(delay: number) {
    if (this.disposed || !this.isDirty) {
      return;
    }
    this.cancelScheduledSave();
    this.saveState = 'scheduled';
    this.saveTimer = this.notebook.timers.setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch(() => {});
    }, delay);
  }

  private cancelScheduledSave() {
    if (this.saveTimer) {
      this.notebook.timers.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}
