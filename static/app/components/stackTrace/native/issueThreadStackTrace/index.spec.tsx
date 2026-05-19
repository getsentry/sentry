import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {IssueThreadStackTrace} from 'sentry/components/stackTrace/native/issueThreadStackTrace';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Event, Thread} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
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

function makeEvent(threads: Thread[]): Event {
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
    platform: 'cocoa',
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
    ProjectsStore.loadInitialData([project]);
    localStorageWrapper.removeItem(storageKey);
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

  it('uses the active thread id for raw downloads', async () => {
    localStorageWrapper.setItem(storageKey, JSON.stringify(['raw-stack-trace']));
    const event = makeEvent([
      makeThread({crashed: true, id: 7}),
      makeThread({id: 8, name: 'worker', stacktrace: makeStacktrace('Worker.run')}),
    ]);

    renderThreadStackTrace(event);

    expect(await screen.findByRole('button', {name: 'Download'})).toHaveAttribute(
      'href',
      '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=false&thread_id=7&download=1'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next Thread'}));

    expect(screen.getByRole('button', {name: 'Download'})).toHaveAttribute(
      'href',
      '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=false&thread_id=8&download=1'
    );
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
