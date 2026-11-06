import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ConversationSpanDetail} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {traceAnalytics} from 'sentry/views/performance/traceDetails/traceAnalytics';
import {TraceTreeNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {AiSpanDetails} from './aiSpanDetails';

const organization = OrganizationFixture();
const project = ProjectFixture({id: '1'});
const sizeField = 'avg(gen_ai.tool.call.result.size)';

function toolNode(spanId = 'tool-span') {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: spanId,
      project_id: 1,
      project_slug: project.slug,
      op: 'gen_ai.execute_tool',
      description: 'execute_tool search',
      additional_attributes: {'gen_ai.operation.type': 'tool'},
    }),
    {organization}
  );
}

function mockAttributes(withSize = true, spanId = 'tool-span') {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/trace-items/${spanId}/`,
    body: {
      itemId: spanId,
      timestamp: '2020-01-01T00:00:00Z',
      meta: {},
      attributes: [
        {name: 'gen_ai.operation.type', type: 'str', value: 'tool'},
        {name: 'gen_ai.tool.name', type: 'str', value: 'search'},
        {name: 'gen_ai.tool.call.result', type: 'str', value: 'legacy output'},
        ...(withSize
          ? [{name: 'gen_ai.tool.call.result.size', type: 'int', value: 4000}]
          : []),
      ],
    },
  });
}

function mockAverage() {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    match: [MockApiClient.matchQuery({field: [sizeField]})],
    body: {data: [{[sizeField]: 1000}]},
  });
}

describe('Result Size highlighted attribute', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{'avg(span.duration)': 100}]},
    });
  });

  it('tracks each selected AI span, but not ordinary rerenders', async () => {
    const trackViewed = jest.spyOn(traceAnalytics, 'trackGenAISpanDetailsViewed');
    mockAttributes();
    mockAttributes(true, 'other-tool-span');
    mockAverage();
    const node = toolNode();
    const onTabScrollToNode = jest.fn();
    const {rerender} = render(
      <TraceTreeNodeDetails
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        traceId="trace-id"
      />,
      {organization}
    );
    expect(await screen.findByText('300% larger than avg 1 kB')).toBeInTheDocument();
    expect(trackViewed).toHaveBeenCalledTimes(1);
    expect(trackViewed).toHaveBeenCalledWith(organization, 'tool');

    rerender(
      <TraceTreeNodeDetails
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        traceId="trace-id"
      />
    );
    expect(trackViewed).toHaveBeenCalledTimes(1);

    rerender(
      <TraceTreeNodeDetails
        node={toolNode('other-tool-span')}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        traceId="trace-id"
      />
    );
    expect(await screen.findByText('300% larger than avg 1 kB')).toBeInTheDocument();
    expect(trackViewed).toHaveBeenCalledTimes(2);
  });

  it('compares size in the shared AI panel without tracking a waterfall view', async () => {
    const trackViewed = jest.spyOn(traceAnalytics, 'trackGenAISpanDetailsViewed');
    mockAttributes();
    const request = mockAverage();
    render(<AiSpanDetails node={toolNode()} traceId="trace-id" />, {organization});
    expect(await screen.findByText('300% larger than avg 1 kB')).toBeInTheDocument();
    expect(trackViewed).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: [sizeField],
          project: [1],
          statsPeriod: '24h',
          query:
            'gen_ai.operation.type:tool has:gen_ai.tool.call.result.size gen_ai.tool.name:search',
        }),
      })
    );
  });

  it('also compares size in standalone conversation details without a parent baseline', async () => {
    const trackViewed = jest.spyOn(traceAnalytics, 'trackGenAISpanDetailsViewed');
    mockAttributes();
    mockAverage();
    const node = toolNode();
    node.value.op = 'execute_tool search';
    render(
      <ConversationSpanDetail
        node={node}
        traceId="trace-id"
        activeTab="input"
        onTabChange={jest.fn()}
      />,
      {organization}
    );
    expect(await screen.findByText('300% larger than avg 1 kB')).toBeInTheDocument();
    expect(screen.getByText('Result Size')).toBeInTheDocument();
    expect(trackViewed).not.toHaveBeenCalled();
  });

  it('retains the calculated size without querying a baseline for legacy spans', async () => {
    mockAttributes(false);
    const request = mockAverage();
    render(
      <ConversationSpanDetail
        node={toolNode()}
        traceId="trace-id"
        activeTab="input"
        onTabChange={jest.fn()}
      />,
      {organization}
    );
    expect(await screen.findByText('13 B')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/larger than avg|smaller than avg/)
    ).not.toBeInTheDocument();
  });
});
