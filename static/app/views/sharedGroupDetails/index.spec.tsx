import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', () => {
  const eventEntry = EventEntryFixture();
  const exception = EventStacktraceExceptionFixture().entries[0];

  const organization = OrganizationFixture({slug: 'test-org'});
  const project = ProjectFixture({organization});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/shared/issues/a/`,
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project,
      }),
    });
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/events/1/actionable-items/`,
      body: {
        errors: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/events/1/committers/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    render(<SharedGroupDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/share/issue/a/`,
        },
        route: '/organizations/:orgId/share/issue/:shareId/',
      },
    });
    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(await screen.findByTestId('sgh-timestamp')).toBeInTheDocument();
  });

  it('renders native crash threads without requesting suspect commits', async () => {
    const thread: Thread = {
      id: 1,
      name: 'main',
      crashed: true,
      current: true,
      rawStacktrace: null,
      stacktrace: {
        frames: [
          FrameFixture({
            function: 'trigger_crash',
            package: '/opt/app/bin/app',
            instructionAddr: '0x560000001150',
            platform: 'native',
            inApp: true,
          }),
        ],
        framesOmitted: null,
        registers: {},
        hasSystemFrames: false,
      },
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/shared/issues/a/`,
      body: GroupFixture({
        title: 'SIGSEGV',
        latestEvent: EventFixture({
          platform: 'native',
          entries: [
            {
              type: EntryType.THREADS,
              data: {
                values: [thread, {...thread, id: 2, name: 'worker', crashed: false}],
              },
            },
          ],
        }),
        project,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    const committers = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/1/committers/`,
      body: {committers: []},
    });

    render(<SharedGroupDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/share/issue/a/`,
        },
        route: '/organizations/:orgId/share/issue/:shareId/',
      },
    });

    expect(await screen.findByText('Thread Stack Trace')).toBeInTheDocument();
    expect(committers).not.toHaveBeenCalled();
  });
});
