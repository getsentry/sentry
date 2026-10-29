import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ConversationSpanDetail} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

const organization = OrganizationFixture();
const project = ProjectFixture({id: '1'});

function makeNode(eventId: string, operationName: string) {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: eventId,
      project_id: 1,
      project_slug: project.slug,
      op: `gen_ai.${operationName}`,
      additional_attributes: {'gen_ai.operation.name': operationName},
    }),
    {organization}
  );
}

function mockAttributes(eventId: string, attributes: Array<Record<string, string>>) {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/trace-items/${eventId}/`,
    body: {itemId: eventId, timestamp: '2020-01-01T00:00:00Z', meta: {}, attributes},
  });
}

function mockDecisionAttributes() {
  mockAttributes('decision-span', [
    {name: 'gen_ai.operation.name', type: 'str', value: 'decide'},
    {
      name: 'gen_ai.input.messages',
      type: 'str',
      value: JSON.stringify([
        {
          type: 'evaluation',
          state: 'I cannot log in.',
          questions: {authIssue: {type: 'boolean'}},
        },
      ]),
    },
    {
      name: 'gen_ai.output.messages',
      type: 'str',
      value: JSON.stringify([
        {type: 'evaluation', answers: {authIssue: {type: 'boolean', probability: 0.9}}},
      ]),
    },
  ]);
}

function mockExtractionAttributes() {
  mockAttributes('extraction-span', [
    {name: 'gen_ai.operation.name', type: 'str', value: 'extract'},
    {
      name: 'gen_ai.input.messages',
      type: 'str',
      value: JSON.stringify([
        {state: 'Invoice INV-2291', fields: {invoice_number: {type: 'text'}}},
      ]),
    },
    {
      name: 'gen_ai.output.messages',
      type: 'str',
      value: JSON.stringify([
        {answers: {invoice_number: {type: 'text', span: [8, 16], value: 'INV-2291'}}},
      ]),
    },
  ]);
}

describe('ConversationSpanDetail tabs', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('shows a Decision tab in place of Input and Output on decision spans', async () => {
    mockDecisionAttributes();
    render(
      <ConversationSpanDetail
        node={makeNode('decision-span', 'decide')}
        traceId="trace-id"
        activeTab="output"
        onTabChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('tab', {name: 'Decision'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', {name: 'Input'})).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Output'})).not.toBeInTheDocument();
    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
  });

  it('shows Input on other spans when Decision is selected', async () => {
    mockAttributes('chat-span', [
      {name: 'gen_ai.operation.name', type: 'str', value: 'chat'},
    ]);
    render(
      <ConversationSpanDetail
        node={makeNode('chat-span', 'chat')}
        traceId="trace-id"
        activeTab="decision"
        onTabChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('tab', {name: 'Input'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', {name: 'Decision'})).not.toBeInTheDocument();
  });

  it('shows an Extraction tab in place of Input and Output on extraction spans', async () => {
    mockExtractionAttributes();
    render(
      <ConversationSpanDetail
        node={makeNode('extraction-span', 'extract')}
        traceId="trace-id"
        activeTab="decision"
        onTabChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('tab', {name: 'Extraction'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', {name: 'Input'})).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Decision'})).not.toBeInTheDocument();
    expect(screen.getByText('invoice_number')).toBeInTheDocument();
    expect(screen.getByText('invoice_number: INV-2291')).toBeInTheDocument();
  });

  it('shows Input on other spans when Extraction is selected', async () => {
    mockAttributes('chat-span', [
      {name: 'gen_ai.operation.name', type: 'str', value: 'chat'},
    ]);
    render(
      <ConversationSpanDetail
        node={makeNode('chat-span', 'chat')}
        traceId="trace-id"
        activeTab="extraction"
        onTabChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('tab', {name: 'Input'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', {name: 'Extraction'})).not.toBeInTheDocument();
  });

  it('keeps legacy MCP arguments as JSON without requesting a Code Mode summary', async () => {
    const attributes = {
      'gen_ai.operation.type': 'tool',
      'gen_ai.tool.name': 'execute_code',
      'mcp.request.argument.code': JSON.stringify('print(1)'),
      'mcp.request.argument.language': JSON.stringify('python'),
    };
    const node = new EapSpanNode(
      null,
      makeEAPSpan({
        event_id: 'tool-span',
        op: 'mcp.server',
        name: 'tools/call execute_code',
        project_id: Number(project.id),
        project_slug: project.slug,
        additional_attributes: attributes,
      }),
      {organization}
    );
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${node.id}/`,
      body: {
        itemId: node.id,
        timestamp: new Date().toISOString(),
        attributes: Object.entries(attributes).map(([name, value]) => ({
          name,
          type: 'str',
          value,
        })),
        meta: {},
      },
    });
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.id}/ai/code-explanation/`,
      method: 'POST',
      body: {summary: 'Print a number'},
    });

    render(
      <ConversationSpanDetail
        node={node}
        traceId="test-trace-id"
        activeTab="input"
        onTabChange={jest.fn()}
      />,
      {organization}
    );

    const input = await screen.findByRole('tabpanel', {name: 'Input'});
    expect(await within(input).findByText('code')).toBeInTheDocument();
    expect(within(input).getByText('language')).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Summary'})).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
