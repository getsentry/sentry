import {EventFixture} from 'sentry-fixture/event';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventStackTrace} from 'sentry/components/events/eventStackTrace';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

describe('EventStackTrace', () => {
  const project = DetailedProjectFixture();
  const group = GroupFixture({project});
  const stacktrace: StacktraceType = {
    frames: [FrameFixture({platform: null, function: 'standaloneFunction'})],
    framesOmitted: null,
    registers: {},
    hasSystemFrames: false,
  };
  const eventWithThreads = EventFixture({
    projectID: project.id,
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {
          values: [
            ExceptionValueFixture({
              type: 'WorkerError',
              value: 'Worker failed',
              threadId: 1,
            }),
          ],
        },
      },
      {type: EntryType.STACKTRACE, data: stacktrace},
      {
        type: EntryType.THREADS,
        data: {
          values: [
            {
              id: 1,
              name: 'worker',
              crashed: true,
              current: true,
              rawStacktrace: null,
              stacktrace: {
                ...stacktrace,
                frames: [FrameFixture({platform: null, function: 'workerFunction'})],
              },
            },
          ],
        },
      },
    ],
  });

  beforeEach(() => {
    localStorage.clear();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/1/committers/`,
      body: {committers: []},
    });
  });

  it('keeps native standalone traces alongside the selected thread and its exception', async () => {
    const event = EventFixture({...eventWithThreads, platform: 'native'});

    render(<EventStackTrace event={event} group={group} projectSlug={project.slug} />);

    expect(await screen.findByText('workerFunction')).toBeInTheDocument();
    expect(screen.getAllByText('WorkerError')).toHaveLength(1);
    expect(screen.getByText('standaloneFunction')).toBeInTheDocument();
  });

  it('shows the selected thread and its exception instead of the non-native standalone trace', async () => {
    const event = EventFixture({...eventWithThreads, platform: 'python'});

    render(<EventStackTrace event={event} group={group} projectSlug={project.slug} />);

    expect(await screen.findByText('workerFunction')).toBeInTheDocument();
    expect(screen.getAllByText('WorkerError')).toHaveLength(1);
    expect(screen.queryByText('standaloneFunction')).not.toBeInTheDocument();
  });
});
