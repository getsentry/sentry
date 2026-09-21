import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {makeSentrySampledProfile} from 'sentry/utils/profiling/profile/testUtils';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

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

  it('renders profile details without a transaction event', async () => {
    const organization = OrganizationFixture({features: ['profiling']});
    const project = ProjectFixture({id: '1', slug: 'project_slug', platform: 'cocoa'});
    const startTimestamp = Date.parse('2022-09-01T09:45:00.000Z') / 1000;
    const spanValue = makeEAPSpan({
      event_id: 'profiled-span-id',
      profile_id: 'profile-id',
      project_id: 1,
      project_slug: project.slug,
      start_timestamp: startTimestamp,
      end_timestamp: startTimestamp + 0.5,
    });
    const node = new EapSpanNode(null, spanValue, createMockExtra({organization}));

    act(() => ProjectsStore.loadInitialData([project]));

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${spanValue.event_id}/`,
      method: 'GET',
      body: {
        itemId: spanValue.event_id,
        timestamp: new Date(startTimestamp * 1000).toISOString(),
        attributes: [
          {name: 'thread.id', type: 'int', value: 0},
          {name: 'platform', type: 'str', value: 'cocoa'},
          {name: 'sdk.name', type: 'str', value: 'sentry.cocoa'},
          {name: 'release', type: 'str', value: '1.0'},
          {name: 'device.arch', type: 'str', value: 'arm64'},
        ],
        meta: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/profiling/profiles/profile-id/`,
      method: 'GET',
      body: makeSentrySampledProfile({
        profile: {
          samples: [
            {stack_id: 0, thread_id: '0', elapsed_since_start_ns: 0},
            {stack_id: 0, thread_id: '0', elapsed_since_start_ns: 100_000_000},
            {stack_id: 0, thread_id: '0', elapsed_since_start_ns: 200_000_000},
            {stack_id: 0, thread_id: '0', elapsed_since_start_ns: 300_000_000},
            {stack_id: 1, thread_id: '1', elapsed_since_start_ns: 0},
            {stack_id: 1, thread_id: '1', elapsed_since_start_ns: 100_000_000},
            {stack_id: 1, thread_id: '1', elapsed_since_start_ns: 200_000_000},
            {stack_id: 1, thread_id: '1', elapsed_since_start_ns: 300_000_000},
          ],
          frames: [
            {
              function: 'profiledFunction',
              instruction_addr: '',
              lineno: 1,
              colno: 1,
              filename: 'main.c',
              in_app: true,
            },
            {
              function: 'backgroundFunction',
              instruction_addr: '',
              lineno: 2,
              colno: 1,
              filename: 'background.c',
              in_app: true,
            },
          ],
          stacks: [[0], [1]],
        },
        transaction: {active_thread_id: 1},
      }),
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
      </TraceStateProvider>,
      {organization}
    );

    expect(
      await screen.findByText('Most Frequent Stacks in this Span')
    ).toBeInTheDocument();
    expect(screen.getByText('profiledFunction')).toBeInTheDocument();
    expect(screen.queryByText('backgroundFunction')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Profile'})).getByRole('button', {
        name: 'Profile',
      })
    ).toHaveAttribute('href', expect.stringContaining('profile-id/flamegraph/'));
  });
});
