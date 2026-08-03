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
};

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

  private confirmed: ConfirmedCellFields;

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
      isPersisted: computed,
      isDirty: computed,
      applyServerSnapshot: action,
      attachServerId: action,
      markDeleted: action,
      restore: action,
    });
  }

  get isPersisted(): boolean {
    return this.serverId !== null;
  }

  get isDirty(): boolean {
    return this.dirtyFields.size > 0;
  }

  attachServerId(serverId: string) {
    this.serverId = serverId;
  }

  markDeleted() {
    this.isDeleted = true;
  }

  restore() {
    this.isDeleted = false;
  }

  applyServerSnapshot(cell: InvestigationCell) {
    this.serverId = cell.id;
    this.position = cell.position;
    this.kind = cell.kind;
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
    };
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
}
