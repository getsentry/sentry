import type {
  InvestigationBlock,
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
    blockCount: 1,
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

export function InvestigationBlockFixture(
  params: Partial<InvestigationBlock> = {}
): InvestigationBlock {
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
    ...params,
  };
}

export function InvestigationDetailFixture(
  params: Partial<InvestigationDetail> = {}
): InvestigationDetail {
  return {
    ...InvestigationListItemFixture(),
    template: null,
    source: {type: 'manual', ref: {}, revision: null},
    filters: {},
    projectIds: [],
    parameters: [],
    blocks: [InvestigationBlockFixture()],
    ...params,
  };
}
