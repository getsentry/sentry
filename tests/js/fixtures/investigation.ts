import type {
  InvestigationCell,
  InvestigationComment,
  InvestigationDetail,
  InvestigationListItem,
} from 'sentry/views/seerNotebook/types';

export function InvestigationListItemFixture(
  params: Partial<InvestigationListItem> = {}
): InvestigationListItem {
  return {
    id: 'c12215ca-8ca0-4f35-930c-7f5d71c72579',
    title: 'Checkout regression',
    status: 'active',
    sourceType: 'manual',
    cellCount: 1,
    isFavorited: false,
    permissions: {
      isEditableByEveryone: true,
      teamIds: [],
      canEdit: true,
      canManage: true,
    },
    createdBy: '1',
    dateCreated: '2020-01-01T00:00:00Z',
    dateUpdated: '2020-01-02T00:00:00Z',
    version: 1,
    ...params,
  };
}

export function InvestigationCellFixture(
  params: Partial<InvestigationCell> = {}
): InvestigationCell {
  return {
    id: 'd491fbe8-f5d3-4cdd-bad8-cc134438d437',
    position: 0,
    kind: 'text',
    title: 'Investigation goal',
    content: 'Understand the regression.',
    generationPrompt: '',
    generatedContent: '',
    output: null,
    outputStatus: 'notRun',
    config: {},
    display: {type: 'markdown'},
    dependencies: [],
    parameterKeys: [],
    version: 1,
    staleAt: null,
    createdBy: '1',
    lastEditedBy: '1',
    reactions: [],
    commentCount: 0,
    ...params,
  };
}

export function InvestigationDetailFixture(
  params: Partial<InvestigationDetail> = {}
): InvestigationDetail {
  return {
    ...InvestigationListItemFixture(),
    template: null,
    source: {type: 'manual', ref: {}},
    filters: {},
    projectIds: [],
    parameters: [],
    cells: [InvestigationCellFixture()],
    ...params,
  };
}

export function InvestigationCommentFixture(
  params: Partial<InvestigationComment> = {}
): InvestigationComment {
  return {
    id: '3bb9c52e-a446-46fa-bd7a-fc855929c8b8',
    body: 'I can reproduce this.',
    author: '1',
    dateCreated: '2020-01-03T00:00:00Z',
    dateUpdated: '2020-01-03T00:00:00Z',
    deletedAt: null,
    mentions: [],
    reactions: [],
    ...params,
  };
}
