import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import {
  makeEAPSpan,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {EAPSpanNodeDetails, SpanNodeDetails} from './index';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('SpanNodeDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders EAP span details with title, ID, op, and description', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project_slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const spanValue = makeEAPSpan({
      event_id: 'test-span-id',
      op: 'db.query',
      description: 'SELECT * FROM users',
      project_id: 1,
      project_slug: 'project_slug',
    });

    const extra = createMockExtra({organization});
    const node = new EapSpanNode(null, spanValue, extra);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${spanValue.event_id}/`,
      method: 'GET',
      body: {
        itemId: spanValue.event_id,
        timestamp: new Date().toISOString(),
        attributes: [],
        meta: {},
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/logs/`,
      method: 'GET',
      body: {data: []},
    });

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <EAPSpanNodeDetails
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

    expect(await screen.findByText('Span')).toBeInTheDocument();

    expect(screen.getByText(/ID: test-span-id/)).toBeInTheDocument();

    expect(screen.getByText('db.query')).toBeInTheDocument();

    expect(screen.getByText(/SELECT \* FROM users/)).toBeInTheDocument();
  });

  it('renders non-EAP span details with title, ID, op, and description', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project_slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const spanValue = makeSpan({
      span_id: 'legacy-span-id',
      op: 'http.client',
      description: 'GET /api/users',
    });

    const extra = createMockExtra({organization});
    const node = new SpanNode(null, spanValue, extra);

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <SpanNodeDetails
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

    expect(screen.getByText('Span')).toBeInTheDocument();

    expect(screen.getByText(/ID: legacy-span-id/)).toBeInTheDocument();

    expect(screen.getAllByText('http.client').length).toBeGreaterThan(0);

    expect(screen.getAllByText(/GET \/api\/users/).length).toBeGreaterThan(0);
  });
});
