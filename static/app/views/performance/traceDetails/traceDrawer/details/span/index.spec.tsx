import {TransactionEventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

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

    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/logs/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      body: [],
    });
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

      render(
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <EAPSpanNodeDetails
            node={node}
            organization={organization}
            onTabScrollToNode={jest.fn()}
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

  it.each(['evented', 'sampled'] as const)(
    'uses the transaction origin and release commit for a timestamp-less %s profile',
    async profileType => {
      const organization = OrganizationFixture({features: ['profiling']});
      const project = ProjectFixture({
        id: '1',
        slug: 'project_slug',
        platform: 'android',
      });
      const startTimestamp = Date.parse('2022-09-01T09:45:00.000Z') / 1000;
      const release = ReleaseFixture({version: '1.0'});
      const transaction = new EapSpanNode(
        null,
        makeEAPSpan({
          event_id: 'transaction-span-id',
          transaction_id: 'transaction-event-id',
          is_transaction: true,
          profile_id: 'profile-id',
          project_id: 1,
          project_slug: project.slug,
          start_timestamp: startTimestamp,
          end_timestamp: startTimestamp + 3,
        }),
        createMockExtra({organization})
      );
      const node = new EapSpanNode(
        transaction,
        makeEAPSpan({
          event_id: 'profiled-span-id',
          project_id: 1,
          project_slug: project.slug,
          start_timestamp: startTimestamp + 2,
          end_timestamp: startTimestamp + 3,
        }),
        createMockExtra({organization})
      );
      const profile: Profiling.EventedProfile | Profiling.SampledProfile = {
        name: 'profile',
        startValue: 0,
        endValue: 3000,
        threadID: 0,
        unit: 'milliseconds',
        ...(profileType === 'evented'
          ? {
              type: 'evented',
              events: [
                {type: 'O', at: 0, frame: 0},
                {type: 'C', at: 2000, frame: 0},
                {type: 'O', at: 2000, frame: 1},
                {type: 'C', at: 3000, frame: 1},
              ],
            }
          : {type: 'sampled', samples: [[0], [1]], weights: [2000, 1000]}),
      };

      act(() => ProjectsStore.loadInitialData([project]));

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/${project.slug}:transaction-event-id/`,
        body: TransactionEventFixture({
          startTimestamp,
          endTimestamp: startTimestamp + 3,
          release,
        }),
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/trace-items/${node.id}/`,
        body: {
          itemId: node.id,
          timestamp: new Date((startTimestamp + 2) * 1000).toISOString(),
          attributes: [
            {name: 'thread.id', type: 'int', value: 0},
            {name: 'release', type: 'str', value: release.version},
          ],
          meta: {},
        },
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/profiling/profiles/profile-id/`,
        body: {
          activeProfileIndex: 0,
          profileID: 'profile-id',
          projectID: 1,
          metadata: {platform: 'android'},
          profiles: [profile],
          shared: {
            frames: [
              {name: 'beforeSpan', file: 'main.java', line: 1, is_application: true},
              {name: 'duringSpan', file: 'main.java', line: 2, is_application: true},
            ],
          },
        },
      });
      const sourceLinkRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        body: {config: null, sourceUrl: null, integrations: []},
      });

      render(
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <EAPSpanNodeDetails
            node={node}
            organization={organization}
            onTabScrollToNode={jest.fn()}
            traceId="test-trace-id"
            tree={null as any}
          />
        </TraceStateProvider>,
        {organization}
      );

      const frame = await screen.findByText('duringSpan');
      expect(screen.queryByText('beforeSpan')).not.toBeInTheDocument();
      await userEvent.hover(frame);
      await waitFor(() =>
        expect(sourceLinkRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({commitId: release.lastCommit!.id}),
          })
        )
      );
    }
  );

  it('uses a nested transaction as its own profile origin when its event is missing', async () => {
    const organization = OrganizationFixture({features: ['profiling']});
    const project = ProjectFixture({id: '1', slug: 'project_slug', platform: 'android'});
    const parentStart = Date.parse('2022-09-01T09:45:00.000Z') / 1000;
    const parent = new EapSpanNode(
      null,
      makeEAPSpan({
        event_id: 'parent-transaction-span-id',
        is_transaction: true,
        project_id: 1,
        project_slug: project.slug,
        start_timestamp: parentStart,
        end_timestamp: parentStart + 3,
      }),
      createMockExtra({organization})
    );
    const node = new EapSpanNode(
      parent,
      makeEAPSpan({
        event_id: 'nested-transaction-span-id',
        transaction_id: 'nested-transaction-event-id',
        is_transaction: true,
        profile_id: 'nested-profile-id',
        project_id: 1,
        project_slug: project.slug,
        start_timestamp: parentStart + 2,
        end_timestamp: parentStart + 3,
      }),
      createMockExtra({organization})
    );

    act(() => ProjectsStore.loadInitialData([project]));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:nested-transaction-event-id/`,
      statusCode: 404,
      body: {detail: 'Event not found'},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${node.id}/`,
      body: {
        itemId: node.id,
        timestamp: new Date((parentStart + 2) * 1000).toISOString(),
        attributes: [{name: 'thread.id', type: 'int', value: 0}],
        meta: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/profiling/profiles/nested-profile-id/`,
      body: {
        activeProfileIndex: 0,
        profileID: 'nested-profile-id',
        projectID: 1,
        metadata: {platform: 'android'},
        profiles: [
          {
            name: 'nested transaction profile',
            startValue: 0,
            endValue: 1000,
            threadID: 0,
            unit: 'milliseconds',
            type: 'sampled',
            samples: [[0]],
            weights: [1000],
          },
        ],
        shared: {
          frames: [
            {name: 'nestedFunction', file: 'main.java', line: 1, is_application: true},
          ],
        },
      },
    });

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <EAPSpanNodeDetails
          node={node}
          organization={organization}
          onTabScrollToNode={jest.fn()}
          traceId="test-trace-id"
          tree={null as any}
        />
      </TraceStateProvider>,
      {organization}
    );

    expect(await screen.findByText('nestedFunction')).toBeInTheDocument();
    expect(screen.getByText('Most Frequent Stacks in this Span')).toBeInTheDocument();
  });

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

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <EAPSpanNodeDetails
          node={node}
          organization={organization}
          onTabScrollToNode={jest.fn()}
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
