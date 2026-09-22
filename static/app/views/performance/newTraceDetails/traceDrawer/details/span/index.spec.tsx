import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {EAPSpanNodeDetails} from './index';

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

  it.each([
    {isTransaction: false, nodeType: 'span'},
    {isTransaction: true, nodeType: 'transaction'},
  ])(
    'renders EAP $nodeType details with ID, op, and description',
    async ({isTransaction}) => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({id: '1', slug: 'project_slug'});

      act(() => ProjectsStore.loadInitialData([project]));

      const spanValue = makeEAPSpan({
        event_id: 'test-span-id',
        op: 'db.query',
        description: 'SELECT * FROM users',
        is_transaction: isTransaction,
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

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/dashboards/`,
        method: 'GET',
        body: [],
      });

      render(
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <EAPSpanNodeDetails
            node={node}
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
    }
  );
});
