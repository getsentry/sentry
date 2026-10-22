import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {ConversationSpanDetail} from './conversationSpanDetail';

describe('ConversationSpanDetail', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('keeps legacy MCP arguments as JSON without requesting a Code Mode summary', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1'});
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
    act(() => ProjectsStore.loadInitialData([project]));
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
