import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
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

  it('renders native crash threads without requesting project data', async () => {
    const stacktrace: StacktraceType = {
      frames: [
        FrameFixture({
          function: 'trigger_crash',
          filename: 'crash.cpp',
          absPath: '/src/crash.cpp',
          package: '/opt/app/bin/app',
          instructionAddr: '0x560000001150',
          platform: 'native',
        }),
      ],
      framesOmitted: null,
      registers: {},
      hasSystemFrames: false,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/shared/issues/a/`,
      body: GroupFixture({
        title: 'SIGSEGV',
        latestEvent: EventFixture({
          platform: 'native',
          entries: [
            {
              type: EntryType.EXCEPTION,
              data: {
                values: [
                  {
                    type: 'SIGSEGV',
                    value: 'Segfault',
                    module: null,
                    mechanism: {type: 'minidump', handled: false},
                    threadId: 1,
                    stacktrace,
                    rawStacktrace: null,
                  },
                ],
              },
            },
            {
              type: EntryType.THREADS,
              data: {
                values: [
                  {
                    id: 1,
                    name: 'main',
                    crashed: true,
                    current: true,
                    stacktrace: null,
                    rawStacktrace: null,
                  },
                  {
                    id: 2,
                    name: 'worker',
                    crashed: false,
                    current: false,
                    stacktrace,
                    rawStacktrace: null,
                  },
                ],
              },
            },
          ],
        }),
        project,
      }),
    });
    const projectRequests = [
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [project],
      }),
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: project,
      }),
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/1/committers/`,
        body: {committers: []},
      }),
    ];

    render(<SharedGroupDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/share/issue/a/`,
        },
        route: '/organizations/:orgId/share/issue/:shareId/',
      },
    });

    expect(await screen.findByText('Thread Stack Trace')).toBeInTheDocument();
    for (const request of projectRequests) {
      expect(request).not.toHaveBeenCalled();
    }
  });
});
