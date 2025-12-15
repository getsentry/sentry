import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {UptimeCheckNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {makeUptimeCheck} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {UptimeNodeDetails} from './index';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('UptimeNodeDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders uptime check details with title and check ID', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project_slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const uptimeCheckValue = makeUptimeCheck({
      event_id: 'test-uptime-check-id',
      name: 'GET https://example.com',
      description: 'Uptime check for example.com',
      project_id: 1,
      project_slug: 'project_slug',
    });

    const extra = createMockExtra({organization});
    const node = new UptimeCheckNode(null, uptimeCheckValue, extra);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${uptimeCheckValue.event_id}/`,
      method: 'GET',
      body: {
        itemId: uptimeCheckValue.event_id,
        timestamp: new Date().toISOString(),
        attributes: [],
        meta: {},
      },
    });

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <UptimeNodeDetails
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

    // Verify title is rendered
    expect(await screen.findByText('Uptime Check Request')).toBeInTheDocument();

    // Verify check ID subtitle is rendered
    expect(screen.getByText(/Check ID: test-uptime-check-id/)).toBeInTheDocument();
  });
});
