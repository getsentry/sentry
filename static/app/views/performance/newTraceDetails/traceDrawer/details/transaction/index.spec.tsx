import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';
import {
  makeEventTransaction,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {TransactionNodeDetails} from './index';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('TransactionNodeDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders transaction details with title, ID, and op', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project-slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const transactionValue = makeTransaction({
      event_id: 'test-transaction-id',
      'transaction.op': 'http.server',
      transaction: 'GET /api/users',
      project_slug: 'project-slug',
      start_timestamp: 1000,
      timestamp: 1001,
    });

    const extra = createMockExtra({organization});
    const node = new TransactionNode(null, transactionValue, extra);

    // Mock the transaction event API
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:${transactionValue.event_id}/`,
      method: 'GET',
      body: makeEventTransaction({
        eventID: transactionValue.event_id,
        projectSlug: project.slug,
        title: 'GET /api/users',
        contexts: {
          trace: {
            op: 'http.server',
          },
        },
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <TransactionNodeDetails
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

    expect(await screen.findByText('Transaction')).toBeInTheDocument();

    expect(screen.getByText(/ID: test-transaction-id/)).toBeInTheDocument();

    expect(screen.getAllByText('http.server').length).toBeGreaterThan(0);

    expect(screen.getAllByText(/GET \/api\/users/).length).toBeGreaterThan(0);
  });
});
