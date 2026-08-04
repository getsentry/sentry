export type InvestigationStatus = 'active' | 'archived';
export type InvestigationCellKind = 'text' | 'query';
export type InvestigationDisplayType =
  | 'markdown'
  | 'table'
  | 'line'
  | 'bar'
  | 'area'
  | 'heatmap'
  | 'wheel';

export type InvestigationReactionName =
  | 'thumbs-up'
  | 'thumbs-down'
  | 'laugh'
  | 'hooray'
  | 'confused'
  | 'heart'
  | 'rocket'
  | 'eyes';

export type InvestigationReaction = {
  count: number;
  reactedByMe: boolean;
  reaction: InvestigationReactionName;
};

export type InvestigationDisplay = {
  type: InvestigationDisplayType;
  axisLabel?: string;
  defaultView?: 'table' | 'chart';
  promptCollapsed?: boolean;
  queryCollapsed?: boolean;
  seriesField?: string;
  showLegend?: boolean;
  sort?: 'none' | 'ascending' | 'descending';
  stacked?: boolean;
  subtitle?: string;
  title?: string;
  topN?: number;
  unit?: InvestigationChartUnit;
  version?: 1;
  xAxis?: string;
  yAxes?: string[];
};

export type InvestigationChartUnit = 'number' | 'percentage' | 'duration' | 'bytes';

export type InvestigationTableColumnType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'duration'
  | 'percentage'
  | 'bytes'
  | 'issue'
  | 'trace'
  | 'event'
  | 'project'
  | 'release';

export type InvestigationTableColumn = {
  key: string;
  label: string;
  type: InvestigationTableColumnType;
  unit?: string | null;
};

export type InvestigationChartSeries = {
  data: Array<{x: string | number; y: number}>;
  name: string;
};

export type InvestigationVisualization = {
  showLegend: boolean;
  sort: 'none' | 'ascending' | 'descending';
  stacked: boolean;
  title: string;
  type: Exclude<InvestigationDisplayType, 'markdown' | 'table'>;
  unit: InvestigationChartUnit;
  xField: string;
  yFields: string[];
  axisLabel?: string | null;
  seriesField?: string | null;
  subtitle?: string | null;
  topN?: number | null;
};

export type InvestigationQueryResult = {
  chart: Record<string, unknown> | null;
  chartUnavailableReason: string | null;
  isEmpty: boolean;
  preferredView: 'table' | 'chart';
  queryLinks: Array<{kind: string; params: Record<string, unknown>}>;
  schemaVersion: 1;
  tableMarkdown: string;
};

export type InvestigationExecutionState = {
  blocks: Array<Record<string, unknown>>;
  error: {code?: string; message?: string} | null;
  id: string;
  partialMarkdown: string | null;
  pendingUserInput: {
    data: Record<string, unknown>;
    id: string;
    input_type: string;
  } | null;
  status: string;
  transcriptTruncated: boolean;
};

export type InvestigationCellExecution = {
  completedAt: string | null;
  error: {code?: string; message?: string} | null;
  executor: string;
  id: string;
  schemaVersion: number;
  startedAt: string | null;
  status: string;
};

export type InvestigationPermissions = {
  canEdit: boolean;
  canManage: boolean;
  isEditableByEveryone: boolean;
  teamIds: number[];
};

export type InvestigationParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'duration'
  | 'datetime_range'
  | 'project'
  | 'project_list'
  | 'environment_list';

export type InvestigationParameter = {
  constraints: Record<string, unknown>;
  defaultValue: unknown;
  description: string;
  id: string;
  key: string;
  label: string;
  position: number;
  required: boolean;
  savedValue: unknown;
  source: 'template' | 'user' | 'agent';
  type: InvestigationParameterType;
  version: number;
};

export type InvestigationCell = {
  commentCount: number;
  config: Record<string, unknown>;
  content: string;
  createdBy: string | null;
  dependencies: string[];
  display: InvestigationDisplay;
  generatedContent: string;
  generationPrompt: string;
  id: string;
  kind: InvestigationCellKind;
  lastEditedBy: string | null;
  output: unknown;
  outputStatus: string;
  parameterKeys: string[];
  position: number;
  reactions: InvestigationReaction[];
  staleAt: string | null;
  title: string;
  version: number;
  currentExecution?: InvestigationCellExecution | null;
};

export type InvestigationListItem = {
  cellCount: number;
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  isFavorited: boolean;
  permissions: InvestigationPermissions;
  sourceType: string;
  status: InvestigationStatus;
  title: string;
  version: number;
};

export type InvestigationFilters = Record<string, unknown> & {
  datetime?: {
    end?: string;
    period?: string;
    start?: string;
    utc?: boolean;
  };
  environments?: string[];
  interval?: string;
  releases?: string[];
};

export type InvestigationDetail = InvestigationListItem & {
  cells: InvestigationCell[];
  filters: InvestigationFilters;
  parameters: InvestigationParameter[];
  permissions: InvestigationPermissions;
  projectIds: number[];
  source: {ref: Record<string, unknown>; type: string};
  template: {key: string; version: number} | null;
  titleGeneration?: {status: string | null};
};

export type InvestigationMention = {
  id: string;
  type: 'user' | 'team';
};

export type InvestigationComment = {
  author: string | null;
  body: string | null;
  dateCreated: string;
  dateUpdated: string;
  deletedAt: string | null;
  id: string;
  mentions: InvestigationMention[];
  reactions: InvestigationReaction[];
};

export type ManualInvestigationCreate = {
  title: string;
  filters?: InvestigationFilters;
  projectIds?: number[];
};

export type TemplateInvestigationCreate = {
  parameters: Record<string, unknown>;
  sourceRef: Record<string, unknown>;
  templateKey: string;
  templateVersion: number;
  title?: string;
};

export type InvestigationCreate = ManualInvestigationCreate | TemplateInvestigationCreate;

export const INVESTIGATION_REACTIONS: ReadonlyArray<{
  emoji: string;
  label: string;
  value: InvestigationReactionName;
}> = [
  {value: 'thumbs-up', emoji: '👍', label: 'Thumbs up'},
  {value: 'thumbs-down', emoji: '👎', label: 'Thumbs down'},
  {value: 'laugh', emoji: '😄', label: 'Laugh'},
  {value: 'hooray', emoji: '🎉', label: 'Hooray'},
  {value: 'confused', emoji: '😕', label: 'Confused'},
  {value: 'heart', emoji: '❤️', label: 'Heart'},
  {value: 'rocket', emoji: '🚀', label: 'Rocket'},
  {value: 'eyes', emoji: '👀', label: 'Eyes'},
];
