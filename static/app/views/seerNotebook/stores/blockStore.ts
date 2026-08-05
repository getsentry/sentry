import isEqual from 'lodash/isEqual';
import {action, computed, makeObservable, observable, runInAction} from 'mobx';

import type {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import {isQueryResult} from 'sentry/views/seerNotebook/stores/visualization';
import type {
  InvestigationBlock,
  InvestigationBlockExecution,
  InvestigationComment,
  InvestigationDisplay,
  InvestigationExecutionState,
  InvestigationMention,
  InvestigationQueryResult,
  InvestigationReaction,
  InvestigationReactionName,
} from 'sentry/views/seerNotebook/types';

const EDITABLE_FIELDS = ['content', 'display', 'generationPrompt', 'title'] as const;
export type BlockEditableField = (typeof EDITABLE_FIELDS)[number];

type ConfirmedBlockFields = Pick<
  InvestigationBlock,
  BlockEditableField | 'position' | 'version'
>;

export type BlockStoreSnapshot = InvestigationBlock & {
  activeView: ResultView;
  clientKey: string;
  comments: InvestigationComment[];
  dirtyFields: BlockEditableField[];
  saveState: BlockSaveState;
};

export type BlockSaveState = 'idle' | 'scheduled' | 'saving' | 'unsaved';
export type ResultView = 'table' | 'chart';
export type CommentLoadState = 'idle' | 'loading' | 'ready' | 'error';

export type BlockActivityEntry = {
  calls: Array<{
    code: string | null;
    function: string;
    result: string | null;
  }>;
  content: string | null;
  id: string;
  policyError: string | null;
};

type ExecutionProjection = Pick<
  BlockStore,
  'currentExecution' | 'output' | 'outputStatus' | 'staleAt'
>;

const TERMINAL_OUTPUT_STATUSES = new Set(['available', 'failed', 'restricted']);
const WORKING_WORDS = [
  'Thinking',
  'Investigating',
  'Searching',
  'Analyzing',
  'Querying',
  'Connecting the dots',
  'Crunching numbers',
  'Checking signals',
  'Comparing patterns',
  'Building the answer',
  'Plotting trends',
  'Verifying results',
  'Wrangling data',
] as const;

function codeFromToolArguments(args: unknown): string | null {
  if (typeof args !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(args) as {code?: unknown};
    return typeof parsed.code === 'string' ? parsed.code.trim() : null;
  } catch {
    return null;
  }
}

function activityHeadline(entry: BlockActivityEntry): string {
  const call = entry.calls.at(-1);
  if (call?.result?.startsWith('Error')) {
    return 'Adjusting the query';
  }
  if (
    call?.code?.includes('artifact_write_') ||
    call?.function.startsWith('artifact_write_')
  ) {
    return 'Preparing the result';
  }
  if (call?.code?.includes('render_chart')) {
    return 'Building the chart';
  }
  if (call?.code?.includes('telemetry_live_search')) {
    return 'Querying your telemetry';
  }
  if (call?.function === 'sentry_api_search') {
    return 'Finding the right data';
  }
  if (entry.content) {
    return 'Writing the answer';
  }
  return 'Working through the data';
}

export class BlockStore {
  readonly clientKey: string;
  readonly notebook: NotebookStore;

  serverId: string | null;
  position: number;
  kind: InvestigationBlock['kind'];
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
  output: InvestigationBlock['output'];
  outputStatus: string;
  currentExecution: InvestigationBlockExecution | null;
  activityBlocks: Array<Record<string, unknown>> = [];
  pendingUserInput: InvestigationExecutionState['pendingUserInput'] = null;
  partialMarkdown: string | null = null;
  transcriptTruncated = false;
  isLoadingExecutionActivity = false;
  activityExpanded = false;
  executionStatusWordIndex = 0;
  executionStatusLabelVersion = 0;
  recentActivityLabel: string | null = null;
  clarificationDraft = '';
  createdBy: string | null;
  lastEditedBy: string | null;
  reactions: InvestigationReaction[];
  commentCount: number;
  isDeleted = false;
  dirtyFields = new Set<BlockEditableField>();
  saveError: string | null = null;
  saveState: BlockSaveState = 'idle';
  isRunRequested = false;
  runError: string | null = null;
  runRequestId: string | null = null;
  failedRunRequestId: string | null = null;
  activeView: ResultView;
  comments: InvestigationComment[] = [];
  commentsNextCursor: string | null = null;
  commentsPageCount = 0;
  commentsLoadState: CommentLoadState = 'idle';
  commentDraft = '';
  commentDraftMentions: string[] = [];
  commentDrafts = new Map<string, {body: string; mentions: string[]}>();
  commentMutationError: string | null = null;
  reactionError: string | null = null;

  private confirmed: ConfirmedBlockFields;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savePromise: Promise<void> | null = null;
  private executionBeforeRun: ExecutionProjection | null = null;
  private statusWordTimer: ReturnType<typeof setInterval> | null = null;
  private recentActivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivitySignature: string | null = null;
  private disposed = false;

  constructor(notebook: NotebookStore, block: InvestigationBlock, clientKey = block.id) {
    this.notebook = notebook;
    this.clientKey = clientKey;
    this.serverId = block.id.startsWith('optimistic-block-') ? null : block.id;
    this.position = block.position;
    this.kind = block.kind;
    this.title = block.title;
    this.content = block.content;
    this.generationPrompt = block.generationPrompt;
    this.generatedContent = block.generatedContent;
    this.config = block.config;
    this.display = block.display;
    this.dependencies = block.dependencies;
    this.parameterKeys = block.parameterKeys;
    this.version = block.version;
    this.staleAt = block.staleAt;
    this.output = block.output;
    this.outputStatus = block.outputStatus;
    this.currentExecution = block.currentExecution ?? null;
    this.activityExpanded = false;
    this.createdBy = block.createdBy;
    this.lastEditedBy = block.lastEditedBy;
    this.reactions = block.reactions;
    this.commentCount = block.commentCount;
    this.activeView =
      block.display.defaultView ??
      (isQueryResult(block.output) ? block.output.preferredView : 'table');
    this.confirmed = this.confirmedFields(block);

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
      activityBlocks: observable.shallow,
      pendingUserInput: observable.ref,
      partialMarkdown: observable,
      transcriptTruncated: observable,
      isLoadingExecutionActivity: observable,
      activityExpanded: observable,
      executionStatusWordIndex: observable,
      executionStatusLabelVersion: observable,
      recentActivityLabel: observable,
      clarificationDraft: observable,
      createdBy: observable,
      lastEditedBy: observable,
      reactions: observable.shallow,
      commentCount: observable,
      isDeleted: observable,
      dirtyFields: observable.shallow,
      saveError: observable,
      saveState: observable,
      isRunRequested: observable,
      runError: observable,
      runRequestId: observable,
      failedRunRequestId: observable,
      activeView: observable,
      comments: observable.shallow,
      commentsNextCursor: observable,
      commentsPageCount: observable,
      commentsLoadState: observable,
      commentDraft: observable,
      commentDraftMentions: observable.shallow,
      commentDrafts: observable.shallow,
      commentMutationError: observable,
      reactionError: observable,
      isPersisted: computed,
      isDirty: computed,
      queryIntent: computed,
      executionIntent: computed,
      executionHasChanged: computed,
      isExecutionRunning: computed,
      executionControlMode: computed,
      executionStatusKind: computed,
      executionStatusLabel: computed,
      hasExecutionFooter: computed,
      isBlockedByDependencies: computed,
      isWaitingForDependencies: computed,
      canRun: computed,
      runButtonVariant: computed,
      queryResult: computed,
      activityEntries: computed,
      chartAvailable: computed,
      chartFallbackWarning: computed,
      chartEmbedData: computed,
      chartPresentationType: computed,
      clarificationOptions: computed,
      compatibleChartTypes: computed,
      effectiveView: computed,
      editTitle: action,
      editContent: action,
      editGenerationPrompt: action,
      editQueryIntent: action,
      updateDisplay: action,
      setPromptSectionCollapsed: action,
      applySlashCommand: action,
      clearQueryIntent: action,
      applyDraft: action,
      changeCommentCount: action,
      markExecutionAccepted: action,
      beginRunRequest: action,
      markExecutionPending: action,
      failRunRequest: action,
      finishRunRequest: action,
      activateExecutionControl: action,
      applyExecutionState: action,
      setActivityExpanded: action,
      loadExecutionActivity: action,
      editClarificationDraft: action,
      setResultView: action,
      applyVisualizationChange: action,
      toggleReaction: action,
      loadComments: action,
      loadMoreComments: action,
      editCommentDraft: action,
      editExistingCommentDraft: action,
      createComment: action,
      updateComment: action,
      deleteComment: action,
      toggleCommentReaction: action,
      markSaveStarted: action,
      confirmSave: action,
      failSave: action,
      applyServerSnapshot: action,
      acknowledgeRemoteSnapshot: action,
      applyExecutionUpdate: action,
      applyRemoteComment: action,
      removeRemoteComment: action,
      applyRemoteReactions: action,
      applyRemoteCommentReactions: action,
      attachServerId: action,
      markDeleted: action,
      markStale: action,
      restore: action,
      dispose: action,
    });
    this.syncStatusWordTimer();
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
    return ['pending', 'running', 'awaiting_input', 'stopping'].includes(
      this.outputStatus
    );
  }

  get executionControlMode(): 'run' | 'retry' | 'stop' {
    if (this.isExecutionRunning) {
      return 'stop';
    }
    return this.outputStatus === 'failed' ? 'retry' : 'run';
  }

  get executionStatusKind(): 'complete' | 'error' | 'stopped' | 'working' {
    if (this.isExecutionRunning) {
      return 'working';
    }
    if (this.outputStatus === 'failed') {
      return 'error';
    }
    if (this.outputStatus === 'canblocked') {
      return 'stopped';
    }
    return 'complete';
  }

  get executionStatusLabel(): string {
    if (this.executionStatusKind === 'working') {
      return this.recentActivityLabel ?? WORKING_WORDS[this.executionStatusWordIndex]!;
    }
    if (this.executionStatusKind === 'error') {
      return 'Stopped because of an error';
    }
    if (this.executionStatusKind === 'stopped') {
      return 'Stopped';
    }
    return 'Completed';
  }

  get hasExecutionFooter(): boolean {
    return (
      this.isExecutionRunning ||
      this.activityEntries.length > 0 ||
      this.currentExecution?.status === 'failed' ||
      this.currentExecution?.status === 'canblocked'
    );
  }

  get isBlockedByDependencies(): boolean {
    if (
      this.config.autoRun !== true ||
      this.dependencies.length === 0 ||
      this.isExecutionRunning ||
      (this.currentExecution !== null && this.staleAt === null)
    ) {
      return false;
    }
    return this.dependencies.some(dependencyId => {
      const dependency = this.notebook.blocksInOrder.find(
        block => block.serverId === dependencyId || block.clientKey === dependencyId
      );
      return (
        dependency?.currentExecution?.status === 'failed' ||
        dependency?.currentExecution?.status === 'canblocked'
      );
    });
  }

  get isWaitingForDependencies(): boolean {
    if (
      this.config.autoRun !== true ||
      this.dependencies.length === 0 ||
      this.isExecutionRunning ||
      (this.currentExecution !== null && this.staleAt === null)
    ) {
      return false;
    }
    if (this.isBlockedByDependencies) {
      return false;
    }
    return this.dependencies.some(dependencyId => {
      const dependency = this.notebook.blocksInOrder.find(
        block => block.serverId === dependencyId || block.clientKey === dependencyId
      );
      return (
        dependency === undefined ||
        dependency.currentExecution?.status !== 'completed' ||
        dependency.staleAt !== null
      );
    });
  }

  get canRun(): boolean {
    return (
      this.notebook.canExecuteQueries &&
      !this.isExecutionRunning &&
      !this.isRunRequested &&
      Boolean(this.executionIntent.trim())
    );
  }

  get runButtonVariant(): 'primary' | 'secondary' | 'warning' {
    if (this.executionHasChanged) {
      return 'warning';
    }
    return this.outputStatus === 'available' ? 'secondary' : 'primary';
  }

  get queryResult() {
    return isQueryResult(this.output) ? this.output : null;
  }

  get activityEntries(): BlockActivityEntry[] {
    return this.activityBlocks.flatMap((block, index) => {
      const message = block.message as
        | {
            content?: string;
            role?: string;
            tool_calls?: Array<{args?: unknown; function?: string}>;
          }
        | undefined;
      if (message?.role === 'user' || (!this.isExecutionRunning && block.loading)) {
        return [];
      }
      const results = block.toolResults as Array<{content?: string} | null> | undefined;
      const blockId =
        typeof block.id === 'string' || typeof block.id === 'number' ? block.id : index;
      return [
        {
          id: String(blockId),
          content: message?.content ?? null,
          policyError: typeof block.policyError === 'string' ? block.policyError : null,
          calls: (message?.tool_calls ?? []).map((call, callIndex) => ({
            function: call.function ?? 'Tool call',
            code: codeFromToolArguments(call.args),
            result: results?.[callIndex]?.content ?? null,
          })),
        },
      ];
    });
  }

  get chartAvailable(): boolean {
    return Boolean(this.queryResult?.chart);
  }

  get chartFallbackWarning(): string | null {
    if (this.chartAvailable || !this.config.preferChart) {
      return null;
    }
    return this.queryResult?.chartUnavailableReason ?? null;
  }

  get chartEmbedData(): InvestigationQueryResult['chart'] {
    const chart = this.queryResult?.chart;
    if (!chart) {
      return null;
    }
    const visualization =
      chart.x_axis === 'category'
        ? 'bar'
        : this.display.type === 'line' ||
            this.display.type === 'bar' ||
            this.display.type === 'area'
          ? this.display.type
          : chart.visualization;
    return {
      ...chart,
      frameless: true,
      ...(this.display.title ? {title: this.display.title} : {}),
      ...(this.display.subtitle ? {subtitle: this.display.subtitle} : {}),
      visualization,
      ...(this.display.unit ? {y_axis_unit: this.display.unit} : {}),
      ...(this.display.axisLabel ? {y_axis_label: this.display.axisLabel} : {}),
      ...(this.display.stacked === undefined ? {} : {stacked: this.display.stacked}),
      ...(this.display.showLegend === undefined
        ? {}
        : {show_legend: this.display.showLegend}),
    };
  }

  get effectiveView(): ResultView {
    return this.activeView !== 'table' && !this.chartAvailable
      ? 'table'
      : this.activeView;
  }

  get compatibleChartTypes(): Array<'line' | 'bar' | 'area'> {
    if (!this.chartAvailable) {
      return [];
    }
    return this.queryResult?.chart?.x_axis === 'category'
      ? ['bar']
      : ['line', 'bar', 'area'];
  }

  get chartPresentationType(): 'line' | 'bar' | 'area' {
    if (['line', 'bar', 'area'].includes(this.display.type)) {
      return this.display.type as 'line' | 'bar' | 'area';
    }
    const type = this.queryResult?.chart?.visualization;
    return type === 'line' || type === 'bar' || type === 'area' ? type : 'line';
  }

  get clarificationOptions(): Array<{label: string; value: string}> {
    const data = this.pendingUserInput?.data;
    const raw = data?.options ?? data?.choices;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.flatMap(choice => {
      if (typeof choice === 'string') {
        return [{label: choice, value: choice}];
      }
      if (!choice || typeof choice !== 'object') {
        return [];
      }
      const value = 'value' in choice ? choice.value : null;
      const label = 'label' in choice ? choice.label : value;
      return typeof value === 'string' && typeof label === 'string'
        ? [{label, value}]
        : [];
    });
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

  editQueryIntent(value: string) {
    const clearsLegacyIntent =
      value === '' && Boolean(this.content || this.confirmed.content);
    this.content = '';
    this.generationPrompt = value;
    if (clearsLegacyIntent) {
      this.dirtyFields.add('content');
      this.dirtyFields.add('generationPrompt');
      this.saveError = null;
      this.saveState = 'scheduled';
    } else {
      this.markDirty('content');
      this.markDirty('generationPrompt');
    }
    this.scheduleSave(600);
  }

  updateDisplay(value: InvestigationDisplay) {
    if (value.defaultView) {
      this.activeView = value.defaultView;
    }
    this.setEditableField('display', value, 400);
  }

  setPromptSectionCollapsed(section: 'prompt' | 'query', collapsed: boolean) {
    this.updateDisplay({
      ...this.display,
      version: 1,
      [section === 'prompt' ? 'promptCollapsed' : 'queryCollapsed']: collapsed,
    });
  }

  setResultView(view: ResultView) {
    if (view !== 'table' && !this.chartAvailable) {
      return;
    }
    this.activeView = view;
    this.updateDisplay({...this.display, version: 1, defaultView: view});
  }

  applyVisualizationChange(change: Partial<InvestigationDisplay>) {
    if (!this.queryResult?.chart) {
      return;
    }
    this.updateDisplay({...this.display, ...change, version: 1});
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

  async toggleReaction(reaction: InvestigationReactionName, enabled: boolean) {
    if (!this.serverId) {
      return;
    }
    const previous = this.reactions;
    const optimistic = updateReaction(previous, reaction, enabled);
    this.reactions = optimistic;
    this.reactionError = null;
    try {
      await this.notebook.transport.setBlockReaction(this.serverId, reaction, enabled);
      await this.notebook.refreshDetail();
    } catch (error) {
      runInAction(() => {
        if (isEqual(this.reactions, optimistic)) {
          this.reactions = previous;
        }
        this.reactionError = 'reaction_failed';
      });
      throw error;
    }
  }

  loadComments(): Promise<void> {
    return this.loadCommentPage(false);
  }

  loadMoreComments(): Promise<void> {
    if (!this.commentsNextCursor || this.commentsLoadState === 'loading') {
      return Promise.resolve();
    }
    return this.loadCommentPage(true);
  }

  editCommentDraft(body: string, mentions: string[] = this.commentDraftMentions) {
    this.commentDraft = body;
    this.commentDraftMentions = mentions;
    this.commentMutationError = null;
  }

  editExistingCommentDraft(commentId: string, body: string, mentions: string[]) {
    this.commentDrafts.set(commentId, {body, mentions});
    this.commentMutationError = null;
  }

  async createComment(body: string, mentions: string[]): Promise<void> {
    if (!this.serverId || !body.trim()) {
      return;
    }
    this.editCommentDraft(body, mentions);
    const temporaryId = `optimistic-comment-${this.notebook.createClientId()}`;
    const now = new Date().toISOString();
    const temporary: InvestigationComment = {
      author: null,
      body,
      dateCreated: now,
      dateUpdated: now,
      deletedAt: null,
      id: temporaryId,
      mentions: mentionsFromTokens(mentions),
      reactions: [],
    };
    this.comments = [...this.comments, temporary];
    this.commentCount += 1;
    this.commentMutationError = null;
    try {
      const created = await this.notebook.transport.createComment(this.serverId, {
        body,
        mentions,
      });
      runInAction(() => {
        this.comments = this.comments.map(comment =>
          comment.id === temporaryId ? created : comment
        );
        if (this.commentDraft === body) {
          this.commentDraft = '';
          this.commentDraftMentions = [];
        }
      });
    } catch (error) {
      runInAction(() => {
        if (this.comments.some(comment => comment.id === temporaryId)) {
          this.comments = this.comments.filter(comment => comment.id !== temporaryId);
          this.commentCount = Math.max(0, this.commentCount - 1);
        }
        this.commentMutationError = 'comment_create_failed';
      });
      throw error;
    }
  }

  async updateComment(
    commentId: string,
    body: string,
    mentions: string[]
  ): Promise<void> {
    const previous = this.comments.find(comment => comment.id === commentId);
    if (!previous || !body.trim()) {
      return;
    }
    this.editExistingCommentDraft(commentId, body, mentions);
    const optimistic = {
      ...previous,
      body,
      dateUpdated: new Date().toISOString(),
      mentions: mentionsFromTokens(mentions),
    };
    this.comments = this.comments.map(comment =>
      comment.id === commentId ? optimistic : comment
    );
    try {
      const updated = await this.notebook.transport.updateComment(commentId, {
        body,
        mentions,
      });
      runInAction(() => {
        this.comments = this.comments.map(comment =>
          comment.id === commentId ? updated : comment
        );
        this.commentDrafts.delete(commentId);
      });
    } catch (error) {
      runInAction(() => {
        const current = this.comments.find(comment => comment.id === commentId);
        if (isEqual(current, optimistic)) {
          this.comments = this.comments.map(comment =>
            comment.id === commentId ? previous : comment
          );
        }
        this.commentMutationError = 'comment_update_failed';
      });
      throw error;
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    const previous = this.comments.find(comment => comment.id === commentId);
    if (!previous) {
      return;
    }
    const tombstone = {...previous, body: null, deletedAt: 'optimistic'};
    this.comments = this.comments.map(comment =>
      comment.id === commentId ? tombstone : comment
    );
    this.commentCount = Math.max(0, this.commentCount - 1);
    try {
      await this.notebook.transport.deleteComment(commentId);
      runInAction(() => {
        this.comments = this.comments.filter(comment => comment.id !== commentId);
        this.commentDrafts.delete(commentId);
      });
    } catch (error) {
      runInAction(() => {
        const current = this.comments.find(comment => comment.id === commentId);
        if (isEqual(current, tombstone)) {
          this.comments = this.comments.map(comment =>
            comment.id === commentId ? previous : comment
          );
          this.commentCount += 1;
        }
        this.commentMutationError = 'comment_delete_failed';
      });
      throw error;
    }
  }

  async toggleCommentReaction(
    commentId: string,
    reaction: InvestigationReactionName,
    enabled: boolean
  ): Promise<void> {
    const previous = this.comments.find(comment => comment.id === commentId);
    if (!previous) {
      return;
    }
    const optimistic = {
      ...previous,
      reactions: updateReaction(previous.reactions, reaction, enabled),
    };
    this.comments = this.comments.map(comment =>
      comment.id === commentId ? optimistic : comment
    );
    try {
      await this.notebook.transport.setCommentReaction(commentId, reaction, enabled);
    } catch (error) {
      runInAction(() => {
        const current = this.comments.find(comment => comment.id === commentId);
        if (isEqual(current, optimistic)) {
          this.comments = this.comments.map(comment =>
            comment.id === commentId ? previous : comment
          );
        }
        this.commentMutationError = 'comment_reaction_failed';
      });
      throw error;
    }
  }

  beginRunRequest(requestId: string) {
    this.isRunRequested = true;
    this.runError = null;
    this.runRequestId = requestId;
  }

  markExecutionPending() {
    this.executionBeforeRun = {
      currentExecution: this.currentExecution,
      output: this.output,
      outputStatus: this.outputStatus,
      staleAt: this.staleAt,
    };
    this.outputStatus = 'pending';
    this.activityBlocks = [];
    this.pendingUserInput = null;
    this.partialMarkdown = null;
    this.activityExpanded = false;
    this.recentActivityLabel = null;
    this.lastActivitySignature = null;
    this.syncStatusWordTimer();
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
    this.failedRunRequestId = null;
    this.executionBeforeRun = null;
  }

  failRunRequest(requestId: string) {
    if (this.runRequestId !== requestId) {
      return;
    }
    if (this.executionBeforeRun) {
      this.currentExecution = this.executionBeforeRun.currentExecution;
      this.output = this.executionBeforeRun.output;
      this.outputStatus = this.executionBeforeRun.outputStatus;
      this.staleAt = this.executionBeforeRun.staleAt;
    }
    this.executionBeforeRun = null;
    this.failedRunRequestId = requestId;
    this.runError = 'execution_start_failed';
    this.syncStatusWordTimer();
  }

  finishRunRequest(requestId: string) {
    if (this.runRequestId === requestId) {
      this.isRunRequested = false;
      this.runRequestId = null;
    }
  }

  applyExecutionState(state: InvestigationExecutionState) {
    const previousSignature = this.lastActivitySignature;
    this.outputStatus = state.status;
    this.activityBlocks = state.blocks;
    this.pendingUserInput = state.pendingUserInput;
    this.partialMarkdown = state.partialMarkdown;
    this.transcriptTruncated = state.transcriptTruncated;
    const latestActivity = this.activityEntries.at(-1);
    const nextSignature = latestActivity
      ? JSON.stringify([
          latestActivity.id,
          latestActivity.content,
          latestActivity.calls.at(-1)?.result,
        ])
      : null;
    this.lastActivitySignature = nextSignature;
    if (
      this.isExecutionRunning &&
      !this.activityExpanded &&
      latestActivity &&
      nextSignature !== previousSignature
    ) {
      this.showRecentActivity(activityHeadline(latestActivity));
    }
    if (!this.isExecutionRunning && !this.isLoadingExecutionActivity) {
      this.activityExpanded = false;
      this.clearRecentActivity();
    }
    this.syncStatusWordTimer();
    if (this.currentExecution) {
      this.currentExecution = {
        ...this.currentExecution,
        status: state.status,
        error: state.error,
      };
    }
  }

  async stopExecution(): Promise<void> {
    if (!this.serverId || !this.currentExecution) {
      return;
    }
    const previousStatus = this.outputStatus;
    this.outputStatus = 'stopping';
    try {
      await this.notebook.transport.stopBlockExecution(
        this.serverId,
        this.currentExecution.id
      );
    } catch (error) {
      runInAction(() => {
        this.outputStatus = previousStatus;
      });
      throw error;
    }
  }

  activateExecutionControl(): Promise<void> {
    if (this.isRunRequested) {
      return Promise.resolve();
    }
    if (this.executionControlMode === 'stop') {
      return this.stopExecution();
    }
    if (this.executionControlMode === 'retry') {
      return this.retryRun();
    }
    return this.run();
  }

  setActivityExpanded(value: boolean) {
    this.activityExpanded = value;
    if (value) {
      this.clearRecentActivity();
      if (this.activityEntries.length === 0) {
        void this.loadExecutionActivity();
      }
    }
  }

  async loadExecutionActivity(): Promise<void> {
    if (this.isLoadingExecutionActivity || !this.serverId || !this.currentExecution) {
      return;
    }
    this.isLoadingExecutionActivity = true;
    try {
      const state = await this.notebook.transport.loadBlockExecution(
        this.serverId,
        this.currentExecution.id
      );
      runInAction(() => this.applyExecutionState(state));
    } catch {
      // Keep the persisted execution error visible even if activity cannot be loaded.
    } finally {
      runInAction(() => {
        this.isLoadingExecutionActivity = false;
      });
    }
  }

  editClarificationDraft(value: string) {
    this.clarificationDraft = value;
  }

  async respondToPendingInput(response = this.clarificationDraft): Promise<void> {
    if (!this.serverId || !this.currentExecution || !this.pendingUserInput) {
      return;
    }
    const previousInput = this.pendingUserInput;
    const previousStatus = this.outputStatus;
    const responseData = response;
    this.pendingUserInput = null;
    this.outputStatus = 'running';
    this.clarificationDraft = '';
    try {
      await this.notebook.transport.respondToBlockExecution(
        this.serverId,
        this.currentExecution.id,
        {inputId: previousInput.id, responseData}
      );
    } catch (error) {
      runInAction(() => {
        this.pendingUserInput = previousInput;
        this.outputStatus = previousStatus;
        this.clarificationDraft = String(responseData);
      });
      throw error;
    }
  }

  run(): Promise<void> {
    return this.notebook.runBlock(this, {retry: false});
  }

  retryRun(): Promise<void> {
    return this.notebook.runBlock(this, {retry: true});
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

    const request = this.notebook.saveBlock(this);
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
        Pick<InvestigationBlock, BlockEditableField>
      >,
    };
  }

  markSaveStarted() {
    this.saveState = 'saving';
    this.saveError = null;
  }

  confirmSave(
    block: InvestigationBlock,
    fields: BlockEditableField[],
    sentValues: Partial<Pick<InvestigationBlock, BlockEditableField>>
  ) {
    const currentValues = Object.fromEntries(
      EDITABLE_FIELDS.map(field => [field, this[field]])
    ) as Pick<InvestigationBlock, BlockEditableField>;

    this.confirmed = this.confirmedFields(block);
    for (const field of fields) {
      if (isEqual(currentValues[field], sentValues[field])) {
        this.dirtyFields.delete(field);
        this[field] = block[field] as never;
      }
    }
    this.applyNonEditableServerFields(block);
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

  applyServerSnapshot(block: InvestigationBlock) {
    this.serverId = block.id;
    this.position = block.position;
    this.kind = block.kind;
    this.applyNonEditableServerFields(block);
    this.isDeleted = false;

    for (const field of EDITABLE_FIELDS) {
      if (!this.dirtyFields.has(field)) {
        this[field] = block[field] as never;
      }
    }
    if (!this.dirtyFields.has('display')) {
      this.activeView =
        block.display.defaultView ??
        (isQueryResult(block.output) ? block.output.preferredView : 'table');
    }
    this.confirmed = this.confirmedFields(block);
  }

  acknowledgeRemoteSnapshot(block: InvestigationBlock) {
    for (const field of EDITABLE_FIELDS) {
      if (this.dirtyFields.has(field) && isEqual(this[field], block[field])) {
        this.dirtyFields.delete(field);
      }
    }
    this.applyServerSnapshot(block);
    this.saveState = this.isDirty ? 'scheduled' : 'idle';
    this.saveError = null;
  }

  getConflictingDirtyFields(block: InvestigationBlock): BlockEditableField[] {
    return EDITABLE_FIELDS.filter(
      field =>
        this.dirtyFields.has(field) && !isEqual(block[field], this.confirmed[field])
    );
  }

  applyExecutionUpdate(
    update: Pick<
      InvestigationBlock,
      | 'content'
      | 'currentExecution'
      | 'generatedContent'
      | 'output'
      | 'outputStatus'
      | 'staleAt'
    >
  ) {
    if (!this.dirtyFields.has('content')) {
      this.content = update.content;
    }
    this.generatedContent = update.generatedContent;
    this.applyExecutionSnapshot({...this.toInvestigationBlock(), ...update});
  }

  applyRemoteComment(comment: InvestigationComment) {
    const existingIndex = this.comments.findIndex(item => item.id === comment.id);
    if (existingIndex < 0) {
      this.comments = [...this.comments, comment];
      this.commentCount += 1;
      return;
    }
    this.comments = this.comments.map(item => (item.id === comment.id ? comment : item));
  }

  removeRemoteComment(commentId: string) {
    if (this.comments.some(comment => comment.id === commentId)) {
      this.comments = this.comments.filter(comment => comment.id !== commentId);
      this.commentCount = Math.max(0, this.commentCount - 1);
    }
  }

  applyRemoteReactions(reactions: InvestigationReaction[]) {
    this.reactions = reactions;
  }

  applyRemoteCommentReactions(commentId: string, reactions: InvestigationReaction[]) {
    this.comments = this.comments.map(comment =>
      comment.id === commentId ? {...comment, reactions} : comment
    );
  }

  toInvestigationBlock(): InvestigationBlock {
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

  toSnapshot(): BlockStoreSnapshot {
    return {
      ...this.toInvestigationBlock(),
      activeView: this.activeView,
      clientKey: this.clientKey,
      comments: [...this.comments],
      dirtyFields: [...this.dirtyFields],
      saveState: this.saveState,
    };
  }

  dispose() {
    this.disposed = true;
    this.cancelScheduledSave();
    if (this.statusWordTimer) {
      clearInterval(this.statusWordTimer);
      this.statusWordTimer = null;
    }
    this.clearRecentActivity();
  }

  protected getConfirmedFields(): ConfirmedBlockFields {
    return this.confirmed;
  }

  private confirmedFields(block: InvestigationBlock): ConfirmedBlockFields {
    return {
      title: block.title,
      content: block.content,
      generationPrompt: block.generationPrompt,
      display: block.display,
      position: block.position,
      version: block.version,
    };
  }

  private applyNonEditableServerFields(block: InvestigationBlock) {
    this.generatedContent = block.generatedContent;
    this.config = block.config;
    this.dependencies = block.dependencies;
    this.parameterKeys = block.parameterKeys;
    this.version = block.version;
    this.applyExecutionSnapshot(block);
    this.createdBy = block.createdBy;
    this.lastEditedBy = block.lastEditedBy;
    this.reactions = block.reactions;
    this.commentCount = block.commentCount;
  }

  private async loadCommentPage(loadMore: boolean): Promise<void> {
    if (!this.serverId || this.commentsLoadState === 'loading') {
      return;
    }
    const pageCount = loadMore ? this.commentsPageCount + 1 : 1;
    this.commentsLoadState = 'loading';
    try {
      const page = await this.notebook.transport.loadComments(this.serverId, pageCount);
      runInAction(() => {
        this.comments = page.items;
        this.commentsNextCursor = page.nextCursor;
        this.commentsPageCount = pageCount;
        this.commentsLoadState = 'ready';
      });
    } catch (error) {
      runInAction(() => {
        this.commentsLoadState = 'error';
      });
      throw error;
    }
  }

  private applyExecutionSnapshot(block: InvestigationBlock) {
    const incomingExecution = block.currentExecution ?? null;
    const currentExecutionId = this.currentExecution?.id ?? null;
    const incomingExecutionId = incomingExecution?.id ?? null;
    const sameExecution =
      currentExecutionId !== null && currentExecutionId === incomingExecutionId;

    if (
      (incomingExecutionId === null && this.isExecutionRunning) ||
      (sameExecution &&
        TERMINAL_OUTPUT_STATUSES.has(this.outputStatus) &&
        ['pending', 'running', 'awaiting_input', 'stopping'].includes(block.outputStatus))
    ) {
      return;
    }

    this.staleAt = block.staleAt;
    this.output = block.output;
    this.outputStatus = block.outputStatus;
    this.currentExecution = incomingExecution;
    if (incomingExecutionId !== null) {
      this.executionBeforeRun = null;
    }
    this.syncStatusWordTimer();
  }

  private syncStatusWordTimer() {
    if (!this.isExecutionRunning) {
      if (this.statusWordTimer) {
        clearInterval(this.statusWordTimer);
        this.statusWordTimer = null;
      }
      return;
    }
    if (this.statusWordTimer) {
      return;
    }
    this.statusWordTimer = setInterval(() => {
      runInAction(() => {
        if (!this.recentActivityLabel) {
          this.executionStatusWordIndex =
            (this.executionStatusWordIndex + 1) % WORKING_WORDS.length;
          this.executionStatusLabelVersion += 1;
        }
      });
    }, 1800);
  }

  private showRecentActivity(label: string) {
    this.clearRecentActivity();
    this.recentActivityLabel = label;
    this.executionStatusLabelVersion += 1;
    this.recentActivityTimer = setTimeout(() => {
      runInAction(() => {
        this.recentActivityLabel = null;
        this.executionStatusLabelVersion += 1;
        this.recentActivityTimer = null;
      });
    }, 3500);
  }

  private clearRecentActivity() {
    if (this.recentActivityTimer) {
      clearTimeout(this.recentActivityTimer);
      this.recentActivityTimer = null;
    }
    this.recentActivityLabel = null;
  }

  private setEditableField<Field extends BlockEditableField>(
    field: Field,
    value: InvestigationBlock[Field],
    debounceMs: number
  ) {
    this[field] = value as never;
    this.markDirty(field);
    this.scheduleSave(debounceMs);
  }

  private markDirty(field: BlockEditableField) {
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

function updateReaction(
  reactions: InvestigationReaction[],
  name: InvestigationReactionName,
  enabled: boolean
): InvestigationReaction[] {
  const existing = reactions.find(reaction => reaction.reaction === name);
  if (!existing) {
    return enabled
      ? [...reactions, {reaction: name, count: 1, reactedByMe: true}]
      : reactions;
  }
  const count = Math.max(0, existing.count + (enabled ? 1 : -1));
  return reactions
    .map(reaction =>
      reaction.reaction === name ? {...reaction, count, reactedByMe: enabled} : reaction
    )
    .filter(reaction => reaction.count > 0);
}

function mentionsFromTokens(tokens: string[]): InvestigationMention[] {
  return tokens.flatMap(token => {
    const [type, id] = token.split(':', 2);
    return (type === 'user' || type === 'team') && id ? [{id, type}] : [];
  });
}
