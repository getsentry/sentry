import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {IssueThreadStackTrace} from 'sentry/components/stackTrace/native/issueThreadStackTrace';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Event, Thread} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {localStorageWrapper} from 'sentry/utils/localStorage';

const organization = OrganizationFixture({slug: 'org-slug'});
const project = DetailedProjectFixture({slug: 'project-slug'});
const storageKey = `issue-details-stracktrace-display-${organization.slug}-${project.slug}`;

function makeStacktrace(functionName: string): StacktraceType {
  return {
    framesOmitted: null,
    hasSystemFrames: true,
    registers: null,
    frames: [
      EventStacktraceFrameFixture({
        function: 'system_start',
        inApp: false,
        instructionAddr: '0x100000100',
        package: '/usr/lib/system/libsystem.dylib',
        platform: 'cocoa',
      }),
      EventStacktraceFrameFixture({
        function: functionName,
        inApp: true,
        instructionAddr: '0x100001000',
        package: '/build/CrashyApp.app/CrashyApp',
        platform: 'cocoa',
        rawFunction: `${functionName}(Any) -> ()`,
      }),
    ],
  };
}

function makeThread(overrides: Partial<Thread>): Thread {
  return {
    crashed: false,
    current: false,
    id: 1,
    name: 'main',
    rawStacktrace: null,
    stacktrace: makeStacktrace('ViewController.causeCrash'),
    ...overrides,
  };
}

function makeEvent(threads: Thread[], platform: PlatformKey = 'cocoa'): Event {
  return {
    id: 'event-id',
    message: 'EXC_BAD_ACCESS',
    title: 'EXC_BAD_ACCESS',
    metadata: {},
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {
          excOmitted: null,
          hasSystemFrames: true,
          values: [
            {
              mechanism: null,
              module: null,
              rawStacktrace: null,
              stacktrace: threads[0]!.stacktrace,
              threadId: threads[0]!.id,
              type: 'EXC_BAD_ACCESS',
              value: 'Attempted to dereference null pointer',
            },
          ],
        },
      },
      {
        type: EntryType.THREADS,
        data: {values: threads},
      },
    ],
    projectID: project.id,
    groupID: '1',
    eventID: 'event-id',
    dateCreated: '2019-05-21T18:01:48.762Z',
    dateReceived: '2019-05-21T18:01:48.762Z',
    tags: [],
    errors: [],
    crashFile: null,
    size: 0,
    dist: null,
    fingerprints: [],
    culprit: '',
    user: null,
    location: '',
    type: EventOrGroupType.ERROR,
    occurrence: null,
    resolvedWith: [],
    contexts: {},
    platform,
  } as Event;
}

function renderThreadStackTrace(event: Event) {
  const threadsEntry = event.entries.find(entry => entry.type === EntryType.THREADS)!;

  return render(
    <IssueThreadStackTrace
      data={threadsEntry.data}
      event={event}
      projectSlug={project.slug}
      groupingCurrentLevel={0}
      group={undefined}
    />,
    {organization}
  );
}

describe('IssueThreadStackTrace', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {dismissed_ts: undefined, snoozed_ts: undefined},
    });
    ProjectsStore.loadInitialData([project]);
    localStorageWrapper.removeItem(storageKey);
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it('renders thread controls and metadata from context', async () => {
    const event = makeEvent([
      makeThread({
        crashed: true,
        heldLocks: {
          '0x0d3a2f0a': {
            address: '0x0d3a2f0a',
            class_name: 'Object',
            package_name: 'java.lang',
            thread_id: 11,
            type: 8,
          },
        },
        id: 7,
        state: 'BLOCKED',
      }),
      makeThread({
        id: 8,
        name: 'worker',
        stacktrace: makeStacktrace('Worker.run'),
        state: 'TIMED_WAITING',
      }),
    ]);

    renderThreadStackTrace(event);

    const threadSelector = await screen.findByTestId('thread-selector');
    expect(threadSelector).toHaveTextContent('Thread #7');
    expect(within(threadSelector).getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.getByText('Thread State')).toBeInTheDocument();
    expect(screen.getByText('Thread Tags')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked')).toHaveLength(2);
    expect(
      screen.getAllByText('waiting to lock <0x0d3a2f0a> held by thread 11')
    ).toHaveLength(2);

    expect(screen.getByRole('heading', {name: 'EXC_BAD_ACCESS'})).toBeInTheDocument();
    expect(screen.getByText('Attempted to dereference null pointer')).toBeInTheDocument();
    expect(screen.getByText('ViewController.causeCrash')).toBeInTheDocument();
  });

  it('renders git provider banner for exception-backed native threads', async () => {
    const event = makeEvent([makeThread({crashed: true, id: 7})]);

    renderThreadStackTrace(event);

    expect(await screen.findByText('Connect with Git Providers')).toBeInTheDocument();
  });

  it('does not render git provider banner for thread-only native stack traces', async () => {
    const event = makeEvent([makeThread({crashed: true, id: 7})]);
    event.entries = event.entries.filter(entry => entry.type !== EntryType.EXCEPTION);

    renderThreadStackTrace(event);

    expect(await screen.findByText('ViewController.causeCrash')).toBeInTheDocument();
    expect(screen.queryByText('Connect with Git Providers')).not.toBeInTheDocument();
  });

  it('changes the active thread without prop plumbing', async () => {
    const event = makeEvent([
      makeThread({crashed: true, id: 7}),
      makeThread({
        id: 8,
        name: 'worker',
        stacktrace: makeStacktrace('Worker.run'),
      }),
    ]);

    renderThreadStackTrace(event);

    const threadSelector = await screen.findByTestId('thread-selector');
    expect(threadSelector).toHaveTextContent('Thread #7');
    expect(screen.getByText('ViewController.causeCrash')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next Thread'}));

    expect(await screen.findByText('Worker.run')).toBeInTheDocument();
    expect(screen.getByTestId('thread-selector')).toHaveTextContent('Thread #8');
    expect(screen.queryByText('ViewController.causeCrash')).not.toBeInTheDocument();
  });

  it('keeps grouping frames visible in most relevant view', async () => {
    const event = makeEvent([
      makeThread({
        crashed: true,
        id: 7,
        stacktrace: {
          framesOmitted: null,
          hasSystemFrames: true,
          registers: null,
          frames: [
            EventStacktraceFrameFixture({
              function: 'grouping_frame',
              inApp: false,
              instructionAddr: '0x100000100',
              minGroupingLevel: 0,
              package: '/usr/lib/system/libsystem.dylib',
              platform: 'cocoa',
            }),
            EventStacktraceFrameFixture({
              function: 'lead_frame',
              inApp: false,
              instructionAddr: '0x100000200',
              package: '/usr/lib/system/libsystem.dylib',
              platform: 'cocoa',
            }),
            EventStacktraceFrameFixture({
              function: 'app_frame',
              inApp: true,
              instructionAddr: '0x100001000',
              package: '/build/CrashyApp.app/CrashyApp',
              platform: 'cocoa',
            }),
          ],
        },
      }),
    ]);

    renderThreadStackTrace(event);

    expect(await screen.findByText('grouping_frame')).toBeInTheDocument();
    expect(
      screen.getByLabelText('This frame is repeated in every event of this issue')
    ).toBeInTheDocument();
  });

  it('passes native frame header metadata for active thread stack traces', async () => {
    const event = makeEvent([makeThread({crashed: true, id: 7})]);
    event._meta = {
      entries: {
        0: {
          data: {
            values: {
              0: {
                stacktrace: {
                  frames: {
                    1: {
                      function: {
                        '': {
                          chunks: [
                            {
                              type: 'redaction',
                              text: '<redacted>',
                              rule_id: 'project:0',
                              remark: 's',
                            },
                            {type: 'text', text: ''},
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Event['_meta'];

    renderThreadStackTrace(event);

    expect(await screen.findByText('<redacted>')).toBeInTheDocument();
    expect(screen.queryByText('ViewController.causeCrash')).not.toBeInTheDocument();
  });

  it('copies the active native thread using raw stack trace formatting', async () => {
    const event = makeEvent([
      makeThread({
        crashed: true,
        id: 7,
        rawStacktrace: makeStacktrace('raw_crash_symbol'),
      }),
    ]);

    renderThreadStackTrace(event);

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Unsymbolicated'}));

    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Text'}));

    const copiedText = jest.mocked(navigator.clipboard.writeText).mock.calls[0]![0];
    expect(copiedText).toContain('Thread: main\n');
    expect(copiedText).toContain('CrashyApp');
    expect(copiedText).toContain('0x100001000');
    expect(copiedText).toContain('raw_crash_symbol');
    expect(copiedText).toContain('libsystem');
    expect(copiedText).not.toContain('ViewController.causeCrash');
    expect(copiedText).not.toContain('undefined');
    expect(copiedText.indexOf('raw_crash_symbol')).toBeLessThan(
      copiedText.indexOf('system_start')
    );
  });

  it('copies the active exception stack trace for exception-backed native threads', async () => {
    const event = makeEvent([
      makeThread({
        crashed: true,
        id: 7,
        stacktrace: makeStacktrace('Thread.onlyFrame'),
      }),
    ]);
    const exceptionEntry = event.entries.find(
      entry => entry.type === EntryType.EXCEPTION
    );
    if (exceptionEntry?.type !== EntryType.EXCEPTION) {
      throw new Error('Expected exception entry');
    }
    exceptionEntry.data.values![0]!.stacktrace = makeStacktrace('Exception.visibleFrame');

    renderThreadStackTrace(event);

    expect(await screen.findByText('Exception.visibleFrame')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Text'}));

    const copiedText = jest.mocked(navigator.clipboard.writeText).mock.calls[0]![0];
    expect(copiedText).toContain('Exception.visibleFrame');
    expect(copiedText).not.toContain('Thread.onlyFrame');
  });

  it('matches old raw thread logic for exception and non-exception threads', async () => {
    localStorageWrapper.setItem(storageKey, JSON.stringify(['raw-stack-trace']));
    const event = makeEvent([
      makeThread({crashed: true, id: 7}),
      makeThread({id: 8, name: 'worker', stacktrace: makeStacktrace('Worker.run')}),
    ]);
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/apple-crash-report`,
      match: [MockApiClient.matchQuery({minified: 'false', thread_id: '7'})],
      body: `OS Version: iOS 15.5 (21A559)
Report Version: 104

Application Specific Information:
happyCustomer (Code: 1)

Thread 7 Crashed:
0   CrashyApp                        0x100001000 ViewController.causeCrash

Thread 7 crashed with ARM Thread State (64-bit):
    x0: 0x0000000000000000

Binary Images:
0x100000000 - 0x10000ffff CrashyApp arm64

EOF`,
    });

    renderThreadStackTrace(event);

    // Matches old ExceptionContent raw behavior: exception-backed native threads
    // render the full Apple crash report.
    expect(await screen.findByText(/OS Version:/)).toBeInTheDocument();
    expect(screen.getByText(/Application Specific Information:/)).toBeInTheDocument();
    expect(await screen.findByText(/Thread 7 Crashed:/)).toBeInTheDocument();
    expect(screen.getByText(/ViewController\.causeCrash/)).toBeInTheDocument();
    expect(screen.getByText(/Binary Images:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Thread 7 crashed with ARM Thread State/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('raw-stack-trace').tagName).toBe('PRE');
    expect(await screen.findByRole('button', {name: 'Download'})).toHaveAttribute(
      'href',
      '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=false&thread_id=7&download=1'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next Thread'}));

    // Matches old StackTraceContent raw behavior: native threads without a
    // matching exception render formatted stacktrace frames, not a .crash report.
    expect(await screen.findByText(/Worker\.run/)).toBeInTheDocument();
    expect(screen.queryByText(/Thread 8/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download'})).toHaveAttribute(
      'href',
      '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=false&thread_id=8&download=1'
    );
  });

  it('falls back to formatted raw frames when apple crash reports are unsupported', async () => {
    localStorageWrapper.setItem(storageKey, JSON.stringify(['raw-stack-trace']));
    const event = makeEvent([makeThread({crashed: true, id: 7})], 'c');

    renderThreadStackTrace(event);

    expect(await screen.findByText(/ViewController\.causeCrash/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Download'})).not.toBeInTheDocument();
  });

  it('renders stacktrace source links from issue frame actions', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config: {provider: {key: 'github', name: 'GitHub'}},
        sourceUrl: 'https://github.com/getsentry/sentry/blob/main/raven/base.py',
        integrations: [],
      },
    });
    const event = makeEvent([makeThread({crashed: true, id: 7})]);

    renderThreadStackTrace(event);

    expect(
      await screen.findByRole('button', {name: 'Open this line in GitHub'})
    ).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/blob/main/raven/base.py#L303'
    );
  });
});
