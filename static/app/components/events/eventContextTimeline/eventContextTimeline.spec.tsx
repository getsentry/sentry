import {Fragment} from 'react';
import {EventFixture} from 'sentry-fixture/event';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  clearEventContextFocus,
  useEventContextFocus,
} from 'sentry/components/events/eventContextTimeline/eventContextFocus';
import {
  AXIS_TICKS,
  EDGE_PAD,
  EventContextTimeline,
  getAxisTicks,
  IDLE_GAP_THRESHOLD_MS,
  MAX_TIMELINE_LOGS,
} from 'sentry/components/events/eventContextTimeline/eventContextTimeline';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {IssueDetailsContext, SectionKey} from 'sentry/views/issueDetails/context';

const organization = OrganizationFixture();

const EVENT_ID = 'ba9e7d4a7e0f4a2d9c1e6f3b8a5d2c70';
const TRACE_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const EVENT_TIME = '2024-03-14T10:00:10.000Z';

const ROUTER_CONFIG = {
  location: {pathname: `/organizations/${organization.slug}/issues/1234/`},
};

/**
 * `convertCrumbType` rewrites a DEFAULT crumb's type from its category, so these
 * fixtures set the type explicitly to pin which lane each crumb is meant to land in.
 */
function BreadcrumbFixture(params: Record<string, unknown> = {}) {
  return {
    type: BreadcrumbType.DEFAULT,
    category: 'app.lifecycle',
    level: BreadcrumbLevelType.INFO,
    message: 'App became active',
    timestamp: '2024-03-14T10:00:09.000Z',
    ...params,
  };
}

function eventWithBreadcrumbs(
  breadcrumbs: Array<Record<string, unknown>>,
  params: Partial<Event> = {}
): Event {
  return EventFixture({
    id: EVENT_ID,
    dateCreated: EVENT_TIME,
    dateReceived: EVENT_TIME,
    contexts: {
      trace: {trace_id: TRACE_ID, span_id: 'b0e6f15b45c36b12', type: 'trace'},
    },
    entries: [{type: EntryType.BREADCRUMBS, data: {values: breadcrumbs}}],
    ...params,
  });
}

/**
 * Two breadcrumbs separated by `gapMs`, with the event itself landing shortly after the
 * second one so the only gap the scale can collapse is the one under test.
 */
function eventWithGap(gapMs: number): Event {
  const start = Date.parse('2024-03-14T10:00:00.000Z');
  return eventWithBreadcrumbs(
    [
      BreadcrumbFixture({timestamp: new Date(start).toISOString()}),
      BreadcrumbFixture({timestamp: new Date(start + gapMs).toISOString()}),
    ],
    {
      dateCreated: new Date(start + gapMs + 500).toISOString(),
      dateReceived: new Date(start + gapMs + 500).toISOString(),
    }
  );
}

/**
 * Reads the focus store through its public hook, so the tests assert what a real
 * section would see rather than reaching into module state.
 */
function FocusProbe({section}: {section: SectionKey}) {
  const {ids, pulse} = useEventContextFocus(section);
  return <div data-test-id="focus-probe" data-ids={ids.join(',')} data-pulse={pulse} />;
}

function readFocus() {
  const probe = screen.getByTestId('focus-probe');
  return {
    ids: probe.getAttribute('data-ids')!.split(',').filter(Boolean),
    pulse: Number(probe.getAttribute('data-pulse')),
  };
}

function TraceEventFixture(params: Record<string, unknown> = {}) {
  return {
    id: '9f81c2ab5d7e40b3aa6c1f9e2d834b57',
    'issue.id': 4242,
    'event.type': 'error',
    title: 'TypeError: Cannot read property "id" of undefined',
    transaction: '/checkout',
    culprit: 'app/checkout in submitOrder',
    timestamp: '2024-03-14T10:00:08.000Z',
    ...params,
  };
}

describe('EventContextTimeline', () => {
  let traceMock: jest.Mock;

  beforeEach(() => {
    clearEventContextFocus();
    MockApiClient.clearMockResponses();
    traceMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
  });

  it('renders nothing when the event is the only thing on the timeline', async () => {
    render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    await waitFor(() => expect(traceMock).toHaveBeenCalled());

    expect(
      screen.queryByRole('region', {name: 'Event Context Timeline'})
    ).not.toBeInTheDocument();
  });

  it('does not draw a marker for the event being viewed', async () => {
    const event = eventWithBreadcrumbs([BreadcrumbFixture()]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Breadcrumbs')).toBeInTheDocument();
    expect(screen.queryByText('Other Issues')).not.toBeInTheDocument();
  });

  it('counts only the markers it drew', async () => {
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({timestamp: '2024-03-14T10:00:07.000Z'}),
      BreadcrumbFixture({timestamp: '2024-03-14T10:00:08.000Z'}),
      BreadcrumbFixture({timestamp: '2024-03-14T10:00:09.000Z'}),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Events Shown')).toBeInTheDocument();
    expect(screen.getAllByText('3')).toHaveLength(1);
  });

  it('hides lanes that have no markers', async () => {
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({type: BreadcrumbType.HTTP, category: 'xhr'}),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Network')).toBeInTheDocument();
    expect(screen.queryByText('Breadcrumbs')).not.toBeInTheDocument();
    expect(screen.queryByText('User Activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });

  it('places breadcrumbs in the lane implied by their type', async () => {
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({
        type: BreadcrumbType.HTTP,
        category: 'xhr',
        timestamp: '2024-03-14T10:00:07.000Z',
      }),
      BreadcrumbFixture({
        type: BreadcrumbType.UI,
        category: 'ui.click',
        timestamp: '2024-03-14T10:00:08.000Z',
      }),
      BreadcrumbFixture({
        type: BreadcrumbType.DEFAULT,
        category: 'app.lifecycle',
        timestamp: '2024-03-14T10:00:09.000Z',
      }),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Network')).toBeInTheDocument();
    expect(screen.getByText('User Activity')).toBeInTheDocument();
    expect(screen.getByText('Breadcrumbs')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View XHR details'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'View UI Click details'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'View app.lifecycle details'})
    ).toBeInTheDocument();
  });

  it('skips breadcrumbs without a usable timestamp', async () => {
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({
        category: 'app.placed',
        timestamp: '2024-03-14T10:00:09.000Z',
      }),
      BreadcrumbFixture({category: 'app.undated', timestamp: null}),
      BreadcrumbFixture({
        category: 'app.garbled',
        timestamp: 'not a timestamp',
      }),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByRole('button', {name: 'View app.placed details'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View app.undated details'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View app.garbled details'})
    ).not.toBeInTheDocument();
  });

  it('keeps drawing breadcrumb lanes when the trace request fails', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({type: BreadcrumbType.HTTP, category: 'xhr'}),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByRole('button', {name: 'View XHR details'})).toBeEnabled();
  });

  it('does not draw the event being viewed twice when the trace returns it', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          TraceEventFixture({id: EVENT_ID, title: 'The Issue Being Viewed'}),
          TraceEventFixture({title: 'A Different Issue'}),
        ],
      },
    });

    render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByRole('button', {
        name: 'View A Different Issue details',
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'View The Issue Being Viewed details',
      })
    ).not.toBeInTheDocument();
  });

  it('separates trace errors from trace transactions', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          TraceEventFixture({title: 'A Different Issue'}),
          TraceEventFixture({
            id: '3c8d1e5a9b7f42c6ae0d5b3f8c9a1e24',
            'event.type': 'transaction',
            title: 'POST /api/checkout',
            timestamp: '2024-03-14T10:00:06.000Z',
          }),
        ],
      },
    });

    render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Other Issues')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('collapses a gap at the idle threshold into an idle band', async () => {
    const event = eventWithGap(IDLE_GAP_THRESHOLD_MS);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Breadcrumbs')).toBeInTheDocument();
    expect(screen.getAllByText(/idle$/)).toHaveLength(1);
  });

  it('leaves a gap just under the idle threshold on the real scale', async () => {
    const event = eventWithGap(IDLE_GAP_THRESHOLD_MS - 1);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Breadcrumbs')).toBeInTheDocument();
    expect(screen.queryByText(/idle$/)).not.toBeInTheDocument();
  });

  it('merges markers that would overlap into a single counted badge', async () => {
    const event = eventWithBreadcrumbs([
      BreadcrumbFixture({
        category: 'app.first',
        timestamp: '2024-03-14T10:00:09.000Z',
      }),
      BreadcrumbFixture({
        category: 'app.second',
        timestamp: '2024-03-14T10:00:09.001Z',
      }),
    ]);

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByRole('button', {name: 'View 2 events'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View app.first details'})
    ).not.toBeInTheDocument();
  });

  describe('axis ticks', () => {
    // One 10s stretch with no idle gap, so the compressed scale is the real one and the
    // expected labels are readable by hand.
    const domainStart = Date.parse('2024-03-14T10:00:00.000Z');
    const domainEnd = domainStart + 10_000;
    const segments = [
      {
        startTime: domainStart,
        endTime: domainEnd,
        startFraction: 0,
        endFraction: 1,
        isIdle: false,
      },
    ];

    it('insets the ticks by the same edge padding as the markers', () => {
      const ticks = getAxisTicks(segments, domainStart);

      // A tick reading "0s" has to land on the pixel a marker at domainStart lands on.
      // Positioning ticks on the raw 0–1 scale put every label EDGE_PAD out of step.
      expect(ticks.map(tick => Number(tick.left.toFixed(4)))).toEqual([
        4, 27, 50, 73, 96,
      ]);
      expect(ticks[0]!.left).toBeCloseTo(EDGE_PAD * 100);
      expect(ticks.at(-1)!.left).toBeCloseTo((1 - EDGE_PAD) * 100);
    });

    it('labels each tick with the instant at its own position', () => {
      const ticks = getAxisTicks(segments, domainStart);

      expect(ticks.map(tick => tick.elapsedSeconds)).toEqual([0, 2.5, 5, 7.5, 10]);
    });

    it('reads the domain start as zero when the timeline has no scale yet', () => {
      const ticks = getAxisTicks([], domainStart);

      expect(ticks).toHaveLength(AXIS_TICKS.length);
      expect(ticks.map(tick => tick.elapsedSeconds)).toEqual([0, 0, 0, 0, 0]);
    });
  });

  it('opens the other issue when its marker is selected', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [TraceEventFixture({title: 'A Different Issue'})]},
    });
    const {router} = render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'View A Different Issue details',
      })
    );

    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/issues/4242/events/9f81c2ab5d7e40b3aa6c1f9e2d834b57/`
    );
  });

  it('addresses the breadcrumbs section when a breadcrumb marker is selected', async () => {
    const event = eventWithBreadcrumbs([BreadcrumbFixture({category: 'app.placed'})]);
    const {router} = render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'View app.placed details'})
    );

    expect(router.location.hash).toBe(`#${SectionKey.BREADCRUMBS}`);
  });

  it('links to the full session when the event carries a session.id tag', async () => {
    const event = eventWithBreadcrumbs([BreadcrumbFixture()], {
      tags: [{key: 'session.id', value: '7f3c9a1b4e2d48f0b6a5c8d2e9f14370'}],
    });

    render(<EventContextTimeline event={event} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByRole('button', {name: 'View Full Session'})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/usersessions/7f3c9a1b4e2d48f0b6a5c8d2e9f14370/`
    );
    expect(
      screen.queryByRole('button', {name: 'View Full Trace'})
    ).not.toBeInTheDocument();
  });

  it('links to the full trace when the event has no session', async () => {
    render(<EventContextTimeline event={eventWithBreadcrumbs([BreadcrumbFixture()])} />, {
      organization,
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByRole('button', {name: 'View Full Trace'})
    ).toBeInTheDocument();
  });

  it('registers itself with the issue details context so Jump To can list it', async () => {
    const dispatch = jest.fn();

    render(
      <IssueDetailsContext
        value={{
          sectionData: {},
          detectorDetails: {},
          isSidebarOpen: true,
          eventCount: 0,
          navScrollMargin: 0,
          dispatch,
        }}
      >
        <EventContextTimeline event={eventWithBreadcrumbs([BreadcrumbFixture()])} />
      </IssueDetailsContext>,
      {organization, initialRouterConfig: ROUTER_CONFIG}
    );

    await screen.findByText('Breadcrumbs');

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_EVENT_SECTION',
      key: SectionKey.EVENT_CONTEXT_TIMELINE,
      config: {initialCollapse: false},
    });
  });

  describe('with logs', () => {
    const logsOrganization = OrganizationFixture({
      features: ['ourlogs-enabled'],
    });
    const project = ProjectFixture();
    const logsStart = Date.parse('2024-03-14T10:00:00.000Z');

    /**
     * Newest first, matching the order the logs query returns. The two oldest carry a
     * distinct severity so the test can tell "kept the newest" apart from "kept any ten".
     */
    function logFixtureAt(id: string, timestamp: number) {
      return LogFixture({
        [OurLogKnownFieldKey.ID]: id,
        [OurLogKnownFieldKey.PROJECT_ID]: project.id,
        [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
        [OurLogKnownFieldKey.TRACE_ID]: TRACE_ID,
        [OurLogKnownFieldKey.SEVERITY]: 'info',
        [OurLogKnownFieldKey.MESSAGE]: `Handled request ${id}`,
        [OurLogKnownFieldKey.TIMESTAMP]: new Date(timestamp).toISOString(),
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(timestamp) * 1_000_000n),
      });
    }

    function logFixtures(count: number) {
      return Array.from({length: count}, (_, index) => {
        const timestamp = logsStart + (count - 1 - index) * 3000;
        return LogFixture({
          [OurLogKnownFieldKey.ID]: `log-${index}`,
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TRACE_ID]: TRACE_ID,
          [OurLogKnownFieldKey.SEVERITY]: index >= MAX_TIMELINE_LOGS ? 'debug' : 'info',
          [OurLogKnownFieldKey.MESSAGE]: `Handled request ${index}`,
          [OurLogKnownFieldKey.TIMESTAMP]: new Date(timestamp).toISOString(),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(timestamp) * 1_000_000n),
        });
      });
    }

    beforeEach(() => {
      ProjectsStore.loadInitialData([project]);
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [Number(project.id)],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      MockApiClient.addMockResponse({url: '/projects/', body: [project]});
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-items/attributes/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/recent-searches/`,
        body: [],
      });
    });

    it('highlights the addressed log when its marker is selected', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-logs/`,
        body: {data: logFixtures(2), meta: {}},
      });
      const {router} = render(
        <Fragment>
          <EventContextTimeline event={eventWithBreadcrumbs([])} />
          <FocusProbe section={SectionKey.LOGS} />
        </Fragment>,
        {organization: logsOrganization, initialRouterConfig: ROUTER_CONFIG}
      );
      await screen.findByText('Logs');

      await userEvent.click(
        screen.getAllByRole('button', {name: 'View info details'})[0]!
      );

      // The section address is durable and belongs in the URL; the highlight is
      // transient and must not be, or every click becomes two navigations.
      expect(router.location.hash).toBe(`#${SectionKey.LOGS}`);
      expect(router.location.query).toEqual({});
      expect(readFocus().ids).toHaveLength(1);
    });

    it('re-announces the same log when its marker is selected twice', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-logs/`,
        body: {data: logFixtures(2), meta: {}},
      });
      render(
        <Fragment>
          <EventContextTimeline event={eventWithBreadcrumbs([])} />
          <FocusProbe section={SectionKey.LOGS} />
        </Fragment>,
        {organization: logsOrganization, initialRouterConfig: ROUTER_CONFIG}
      );
      await screen.findByText('Logs');
      const marker = screen.getAllByRole('button', {name: 'View info details'})[0]!;

      await userEvent.click(marker);
      const firstPulse = readFocus().pulse;
      await userEvent.click(marker);

      // A repeat click has to replay the highlight. Under the old query-param scheme
      // the router treated it as a no-op, which is what the focus nonce existed for.
      expect(readFocus().pulse).toBeGreaterThan(firstPulse);
    });

    it('highlights every clustered log when their merged marker is selected', async () => {
      // Close enough to the event that no idle gap opens between them and it — an idle
      // gap would stretch the 1ms between the two logs across most of the track.
      const clusteredAt = Date.parse('2024-03-14T10:00:09.000Z');
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-logs/`,
        body: {
          data: [
            logFixtureAt('log-a', clusteredAt),
            logFixtureAt('log-b', clusteredAt + 1),
          ],
          meta: {},
        },
      });
      render(
        <Fragment>
          <EventContextTimeline event={eventWithBreadcrumbs([])} />
          <FocusProbe section={SectionKey.LOGS} />
        </Fragment>,
        {organization: logsOrganization, initialRouterConfig: ROUTER_CONFIG}
      );

      await userEvent.click(await screen.findByRole('button', {name: 'View 2 events'}));

      // Both logs hide behind one marker, so both have to pulse — highlighting only the
      // representative would send the reader to a row they did not click.
      expect(readFocus().ids).toEqual(['log-a', 'log-b']);
    });

    it('keeps a log marker with no row to open hoverable rather than disabled', async () => {
      // A log without an id has no row to scroll to, so its marker has no action. It
      // still carries a tooltip, and a disabled button leaves the tab order and stops
      // firing pointer events — which would put that tooltip out of reach for mouse
      // and keyboard alike.
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-logs/`,
        body: {
          data: [logFixtureAt('', Date.parse('2024-03-14T10:00:09.000Z'))],
          meta: {},
        },
      });
      render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
        organization: logsOrganization,
        initialRouterConfig: ROUTER_CONFIG,
      });

      const marker = await screen.findByRole('button', {name: 'View info details'});

      expect(marker).toBeEnabled();
    });

    it('draws only the most recent logs once the lane is over its cap', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${logsOrganization.slug}/trace-logs/`,
        body: {data: logFixtures(MAX_TIMELINE_LOGS + 2), meta: {}},
      });

      render(<EventContextTimeline event={eventWithBreadcrumbs([])} />, {
        organization: logsOrganization,
        initialRouterConfig: ROUTER_CONFIG,
      });

      expect(await screen.findByText('Logs')).toBeInTheDocument();
      expect(screen.getAllByRole('button', {name: 'View info details'})).toHaveLength(
        MAX_TIMELINE_LOGS
      );
      expect(
        screen.queryByRole('button', {name: 'View debug details'})
      ).not.toBeInTheDocument();
    });
  });
});
