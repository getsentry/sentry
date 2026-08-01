export type InvestigationStatus = 'active' | 'archived';
export type InvestigationCellKind = 'text' | 'query';
export type InvestigationDisplayType = 'markdown' | 'table' | 'line' | 'bar' | 'area';

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
  xAxis?: string;
  yAxes?: string[];
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
