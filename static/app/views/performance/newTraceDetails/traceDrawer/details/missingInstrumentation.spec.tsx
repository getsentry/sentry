import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {NoInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/noInstrumentationNode';
import {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import {makeSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {MissingInstrumentationNodeDetails} from './missingInstrumentation';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('MissingInstrumentationNodeDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders missing instrumentation details with title and subtitle', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project_slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const extra = createMockExtra({organization});

    // Create previous and next span nodes
    const previousSpanValue = makeSpan({
      span_id: 'previous-span-id',
      op: 'db.query',
      description: 'SELECT * FROM users',
      start_timestamp: 1000,
      timestamp: 1001,
    });
    const previousNode = new SpanNode(null, previousSpanValue, extra);

    const nextSpanValue = makeSpan({
      span_id: 'next-span-id',
      op: 'http.client',
      description: 'GET /api/data',
      start_timestamp: 1002,
      timestamp: 1003,
    });
    const nextNode = new SpanNode(null, nextSpanValue, extra);

    // Create the missing instrumentation span value
    const missingInstrumentationValue = {
      type: 'missing_instrumentation' as const,
      start_timestamp: 1001,
      timestamp: 1002,
    };

    const node = new NoInstrumentationNode(
      previousNode,
      nextNode,
      null,
      missingInstrumentationValue,
      extra
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/:/`,
      method: 'GET',
      body: null,
    });

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <MissingInstrumentationNodeDetails
          node={node as any}
          organization={organization}
          onTabScrollToNode={jest.fn()}
          onParentClick={jest.fn()}
          manager={null}
          replay={null}
          traceId="test-trace-id"
          tree={null as any}
        />
      </TraceStateProvider>
    );

    expect(screen.getByText('No Instrumentation')).toBeInTheDocument();

    expect(screen.getByText('How Awkward')).toBeInTheDocument();

    expect(
      screen.getByText(/It looks like there's more than 100ms unaccounted for/)
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "If you'd prefer, you can also turn the feature off in the settings above."
      )
    ).toBeInTheDocument();
  });
});
