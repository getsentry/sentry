import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {AiSpanDetails} from './aiSpanDetails';
import {AVG_TOOL_OUTPUT_SIZE} from './index';

const organization = OrganizationFixture();
const project = ProjectFixture({id: '1'});

function toolNode() {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: 'tool-span',
      project_id: 1,
      project_slug: project.slug,
      op: 'gen_ai.execute_tool',
      description: 'execute_tool search',
      start_timestamp: 1000,
      end_timestamp: 1000.4,
      additional_attributes: {'gen_ai.operation.type': 'tool'},
    }),
    {organization}
  );
}

function mockAttributes(size: number | string | undefined) {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/trace-items/tool-span/`,
    body: {
      itemId: 'tool-span',
      timestamp: '2020-01-01T00:00:00Z',
      meta: {},
      attributes: [
        {name: 'gen_ai.operation.type', type: 'str', value: 'tool'},
        {name: 'gen_ai.tool.call.result', type: 'str', value: 'legacy output'},
        ...(size === undefined
          ? []
          : [
              {
                name: 'gen_ai.tool.call.result.size',
                type: typeof size === 'number' ? 'int' : 'str',
                value: size,
              },
            ]),
      ],
    },
  });
}

function mockAverages(baseline: number | undefined) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    body: {
      data: [
        {
          'avg(span.duration)': 100,
          [AVG_TOOL_OUTPUT_SIZE]: baseline,
        },
      ],
    },
  });
}

describe('AI span size comparison', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
  });

  it('batches the size baseline with duration and explains the cohort', async () => {
    mockAttributes(4000);
    const request = mockAverages(1000);
    render(<AiSpanDetails node={toolNode()} traceId="trace-id" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            project: '2',
            environment: 'production',
            start: '2020-01-01T00:00:00',
            end: '2020-01-02T00:00:00',
          },
        },
      },
    });

    expect(await screen.findByText('300% larger than avg 1 kB')).toBeInTheDocument();
    expect(screen.getByText(/300% slower than avg/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['avg(span.duration)', AVG_TOOL_OUTPUT_SIZE],
          project: ['1'],
          environment: [],
          statsPeriod: '24h',
          query: 'span.op:gen_ai.execute_tool span.description:"execute_tool search"',
        }),
      })
    );
    await userEvent.hover(screen.getByText('300% larger than avg 1 kB'));
    expect(
      await screen.findByText(
        'Average output size for matching tool calls in this project over the last 24 hours'
      )
    ).toBeInTheDocument();
  });

  it('does not query output size for non-tool spans', async () => {
    mockAttributes(4000);
    const request = mockAverages(1000);
    const node = toolNode();
    node.value.additional_attributes = {'gen_ai.operation.type': 'ai_client'};
    render(<AiSpanDetails node={node} traceId="trace-id" />, {organization});

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({field: ['avg(span.duration)']}),
        })
      )
    );
  });

  it('shows comparisons at the 10% threshold', async () => {
    mockAttributes(1100);
    mockAverages(1000);
    render(<AiSpanDetails node={toolNode()} traceId="trace-id" />, {organization});
    expect(await screen.findByText('10% larger than avg 1 kB')).toBeInTheDocument();
  });

  it.each([0, '0', 500, '500'])(
    'compares reported size %p, including zero and string values',
    async size => {
      mockAttributes(size);
      mockAverages(1000);
      render(<AiSpanDetails node={toolNode()} traceId="trace-id" />, {organization});
      const percent = Number(size) === 0 ? 100 : 50;
      expect(
        await screen.findByText(`${percent}% smaller than avg 1 kB`)
      ).toBeInTheDocument();
    }
  );

  it.each([
    {size: 1090, baseline: 1000},
    {size: 1000, baseline: 1000},
    {size: 4000, baseline: 0},
    {size: 4000, baseline: undefined},
    {size: undefined, baseline: 1000},
    {size: 'invalid', baseline: 1000},
  ])('hides unavailable or insignificant comparisons: %p', async ({size, baseline}) => {
    mockAttributes(size);
    const request = mockAverages(baseline);
    render(<AiSpanDetails node={toolNode()} traceId="trace-id" />, {organization});
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(await screen.findByText('No input for this span')).toBeInTheDocument();
    expect(await screen.findByText(/300% slower than avg/)).toBeInTheDocument();
    expect(
      screen.queryByText(/larger than avg|smaller than avg/)
    ).not.toBeInTheDocument();
  });
});
