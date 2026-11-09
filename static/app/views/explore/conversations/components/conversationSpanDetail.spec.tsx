import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {ConversationSpanDetail} from './conversationSpanDetail';

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

describe('ConversationSpanDetail', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      body: [
        DashboardFixture([], {
          id: '100',
          prebuiltId: PrebuiltDashboardId.AI_AGENTS_MODELS,
        }),
        DashboardFixture([], {
          id: '200',
          prebuiltId: PrebuiltDashboardId.AI_AGENTS_TOOLS,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
  });

  it.each([
    ['gen_ai.response.model', 'gpt-4o', 'chat', 'View model dashboard', '100'],
    ['gen_ai.tool.name', 'lookup', 'execute_tool', 'View tool dashboard', '200'],
  ] as const)(
    'shows a dashboard button after %s',
    async (field, value, operation, label, id) => {
      mockAttributes('ai-span', [
        {
          name: 'gen_ai.operation.type',
          type: 'str',
          value: operation === 'chat' ? 'ai_client' : 'tool',
        },
        {name: field, type: 'str', value},
      ]);
      render(
        <ConversationSpanDetail
          node={makeNode('ai-span', operation)}
          traceId="trace-id"
          activeTab="input"
          onTabChange={jest.fn()}
        />,
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: '/',
              query: {
                project: ['1', '2'],
                environment: 'production',
                start: '2026-06-01T00:00:00',
                end: '2026-06-01T00:00:05',
                utc: 'true',
              },
            },
          },
        }
      );

      const dashboardButton = await screen.findByRole('button', {name: label});
      const url = new URL(dashboardButton.getAttribute('href')!, 'https://sentry.io');
      expect(url.pathname).toBe(`/organizations/${organization.slug}/dashboard/${id}/`);
      expect(url.searchParams.getAll('project')).toEqual(['1', '2']);
      expect(url.searchParams.get('environment')).toBe('production');
      expect(url.searchParams.has('statsPeriod')).toBe(false);
      expect(url.searchParams.has('start')).toBe(false);
      expect(url.searchParams.has('end')).toBe(false);
      expect(url.searchParams.has('utc')).toBe(false);
      expect(JSON.parse(url.searchParams.get('globalFilter')!).value).toBe(
        `${field}:[${value}]`
      );
      expect(screen.getByText(value)).toAppearBefore(dashboardButton);
    }
  );

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
});
