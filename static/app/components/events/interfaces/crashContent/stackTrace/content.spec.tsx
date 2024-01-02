import {Event as EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktrace} from 'sentry-fixture/eventEntryStacktrace';
import {EventStacktraceFrame} from 'sentry-fixture/eventStacktraceFrame';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventOrGroupType} from 'sentry/types';
import {StacktraceType} from 'sentry/types/stacktrace';

const organization = Organization();
const project = ProjectFixture({});

const integration = GitHubIntegrationFixture();
const repo = Repository({integrationId: integration.id});

const config = RepositoryProjectPathConfig({project, repo, integration});

const eventEntryStacktrace = EventEntryStacktrace();
const event = EventFixture({
  projectID: project.id,
  entries: [eventEntryStacktrace],
  type: EventOrGroupType.ERROR,
});

const data = eventEntryStacktrace.data as Required<StacktraceType>;

function renderedComponent(
  props: Partial<React.ComponentProps<typeof StackTraceContent>>
) {
  return render(
    <StackTraceContent
      data={data}
      className="no-exception"
      platform="other"
      event={event}
      newestFirst
      includeSystemFrames
      {...props}
    />
  );
}

describe('StackTrace', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: promptResponse,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    ProjectsStore.loadInitialData([project]);
  });
  it('renders', function () {
    renderedComponent({});

    // stack trace content
    const stackTraceContent = screen.getByTestId('stack-trace-content');
    expect(stackTraceContent).toBeInTheDocument();

    // stack trace content has to have a platform icon and a frame list
    expect(stackTraceContent.children).toHaveLength(2);

    // platform icon
    expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();

    // frame list
    const frames = screen.getByTestId('frames');
    expect(frames.children).toHaveLength(5);
  });

  it('renders the frame in the correct order', function () {
    renderedComponent({});

    // frame - filename
    const frameFilenames = screen.getAllByTestId('filename');
    expect(frameFilenames).toHaveLength(5);
    expect(frameFilenames[0]).toHaveTextContent('raven/scripts/runner.py');
    expect(frameFilenames[1]).toHaveTextContent('raven/scripts/runner.py');
    expect(frameFilenames[2]).toHaveTextContent('raven/base.py');
    expect(frameFilenames[3]).toHaveTextContent('raven/base.py');
    expect(frameFilenames[4]).toHaveTextContent('raven/base.py');

    // frame - function
    const frameFunction = screen.getAllByTestId('function');
    expect(frameFunction).toHaveLength(5);
    expect(frameFunction[0]).toHaveTextContent('main');
    expect(frameFunction[1]).toHaveTextContent('send_test_message');
    expect(frameFunction[2]).toHaveTextContent('captureMessage');
    expect(frameFunction[3]).toHaveTextContent('capture');
    expect(frameFunction[4]).toHaveTextContent('build_msg');
  });

  it('collapse/expand frames by clicking anywhere in the frame element', async function () {
    renderedComponent({});
    // frame list
    const frames = screen.getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    // only one frame is expanded by default
    expect(screen.getByTestId('toggle-button-expanded')).toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(4);

    // clickable list item element
    const frameTitles = screen.getAllByTestId('title');

    // collapse the expanded frame (by default)
    await userEvent.click(frameTitles[0]);

    // all frames are now collapsed
    expect(screen.queryByTestId('toggle-button-expanded')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    // expand penultimate and last frame
    await userEvent.click(frameTitles[frameTitles.length - 2]);
    await userEvent.click(frameTitles[frameTitles.length - 1]);

    // two frames are now collapsed
    expect(screen.getAllByTestId('toggle-button-expanded')).toHaveLength(2);
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(3);
  });

  it('collapse/expand frames by clicking on the toggle button', async function () {
    renderedComponent({});

    // frame list
    const frames = screen.getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    const expandedToggleButtons = screen.getByTestId('toggle-button-expanded');

    // only one frame is expanded by default
    expect(expandedToggleButtons).toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(4);

    // collapse the expanded frame (by default)
    await userEvent.click(expandedToggleButtons);

    // all frames are now collapsed
    expect(screen.queryByTestId('toggle-button-expanded')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    const collapsedToggleButtons = screen.getAllByTestId('toggle-button-collapsed');

    // expand penultimate and last frame
    await userEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 2]);
    await userEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 1]);

    // two frames are now collapsed
    expect(screen.getAllByTestId('toggle-button-expanded')).toHaveLength(2);
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(3);
  });

  it('if all in_app equals false, all the frames are showing by default', function () {
    renderedComponent({});

    // frame list
    const frames = screen.getByTestId('frames');
    expect(frames.children).toHaveLength(5);
  });

  it('if frames are omitted, renders omitted frames', function () {
    const newData = {
      ...data,
      framesOmitted: [0, 3],
    };

    renderedComponent({
      data: newData,
    });

    const omittedFrames = screen.getByText(
      'Frames 0 until 3 were omitted and not available.'
    );
    expect(omittedFrames).toBeInTheDocument();
  });

  it('does not render non in app tags', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: false};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
    });

    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('displays a toggle button when there is more than one non-inapp frame', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.getByText('Show 3 more frames')).toBeInTheDocument();
  });

  it('shows/hides frames when toggle button clicked', async function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};
    dataFrames[1] = {...dataFrames[1], function: 'non-in-app-frame'};
    dataFrames[2] = {...dataFrames[2], function: 'non-in-app-frame'};
    dataFrames[3] = {...dataFrames[3], function: 'non-in-app-frame'};
    dataFrames[4] = {...dataFrames[4], function: 'non-in-app-frame'};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });
    await userEvent.click(screen.getByText('Show 3 more frames'));
    expect(screen.getAllByText('non-in-app-frame')).toHaveLength(4);
    await userEvent.click(screen.getByText('Hide 3 more frames'));
    expect(screen.getByText('non-in-app-frame')).toBeInTheDocument();
  });

  it('does not display a toggle button when there is only one non-inapp frame', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};
    dataFrames[2] = {...dataFrames[2], inApp: true};
    dataFrames[4] = {...dataFrames[4], inApp: true};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.queryByText(/Show .* more frames*/)).not.toBeInTheDocument();
  });

  describe('if there is a frame with in_app equal to true, display only in_app frames', function () {
    it('displays crashed from only', function () {
      const dataFrames = [...data.frames];

      const newData = {
        ...data,
        hasSystemFrames: true,
        frames: [
          {...dataFrames[0], inApp: true},
          ...dataFrames.splice(1, dataFrames.length),
        ],
      };

      renderedComponent({
        data: newData,
        event: EventFixture({
          ...event,
          entries: [{...event.entries[0], stacktace: newData.frames}],
        }),
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = screen.getAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0]).toHaveTextContent(
        'Crashed in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1]).toHaveTextContent('raven/base.py in build_msg at line 303');
    });

    it('displays called from only', function () {
      const dataFrames = [...data.frames];

      const newData = {
        ...data,
        hasSystemFrames: true,
        registers: {},
        frames: [
          ...dataFrames.splice(0, dataFrames.length - 1),
          {...dataFrames[dataFrames.length - 1], inApp: true},
        ],
      };

      renderedComponent({
        data: newData,
        event: EventFixture({
          ...event,
          entries: [{...event.entries[0], stacktrace: newData.frames}],
        }),
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = screen.getAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0]).toHaveTextContent(
        'raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1]).toHaveTextContent(
        'Called from: raven/scripts/runner.py in send_test_message at line 77'
      );
    });

    it('displays crashed from and called from', function () {
      const dataFrames = [...data.frames];

      const newData = {
        ...data,
        hasSystemFrames: true,
        frames: [
          ...dataFrames.slice(0, 1),
          {...dataFrames[1], inApp: true},
          ...dataFrames.slice(2, dataFrames.length),
        ],
      };

      renderedComponent({
        data: newData,
        event: EventFixture({
          ...event,
          entries: [{...event.entries[0], stacktrace: newData.frames}],
        }),
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = screen.getAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(3);

      expect(frameTitles[0]).toHaveTextContent(
        'Crashed in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1]).toHaveTextContent('raven/base.py in capture at line 459');
      expect(frameTitles[2]).toHaveTextContent(
        'Called from: raven/base.py in build_msg at line 303'
      );
    });

    it('displays "occurred in" when event is not an error', function () {
      const dataFrames = [...data.frames];

      const newData = {
        ...data,
        hasSystemFrames: true,
        frames: [
          {...dataFrames[0], inApp: true},
          ...dataFrames.splice(1, dataFrames.length),
        ],
      };

      renderedComponent({
        data: newData,
        event: EventFixture({
          ...event,
          entries: [{...event.entries[0], stacktrace: newData.frames}],
          type: EventOrGroupType.TRANSACTION,
        }),
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = screen.getAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0]).toHaveTextContent(
        'Occurred in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1]).toHaveTextContent('raven/base.py in build_msg at line 303');
    });

    it('displays "occurred in" when event is an ANR error', function () {
      const dataFrames = [...data.frames];

      const newData = {
        ...data,
        hasSystemFrames: true,
        frames: [
          {...dataFrames[0], inApp: true},
          ...dataFrames.splice(1, dataFrames.length),
        ],
      };

      renderedComponent({
        data: newData,
        event: EventFixture({
          ...event,
          entries: [{...event.entries[0], stacktrace: newData.frames}],
          type: EventOrGroupType.ERROR,
          tags: [{key: 'mechanism', value: 'ANR'}],
        }),
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = screen.getAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0]).toHaveTextContent(
        'Occurred in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1]).toHaveTextContent('raven/base.py in build_msg at line 303');
    });
  });

  describe('platform icons', function () {
    it('uses the top in-app frame file extension for mixed stack trace platforms', function () {
      renderedComponent({
        data: {
          ...data,
          frames: [
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo.cs',
            }),
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo.py',
            }),
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo',
            }),
            EventStacktraceFrame({
              inApp: false,
              filename: 'foo.rb',
            }),
          ],
        },
      });

      // foo.py is the most recent in-app frame with a valid file extension
      expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();
    });

    it('uses frame.platform if file extension does not work', function () {
      renderedComponent({
        data: {
          ...data,
          frames: [
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo.cs',
            }),
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo',
              platform: 'node',
            }),
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo',
            }),
            EventStacktraceFrame({
              inApp: false,
              filename: 'foo.rb',
            }),
          ],
        },
      });

      expect(screen.getByTestId('platform-icon-node')).toBeInTheDocument();
    });

    it('falls back to the event platform if there is no other information', function () {
      renderedComponent({
        data: {
          ...data,
          frames: [
            EventStacktraceFrame({
              inApp: true,
              filename: 'foo',
              platform: null,
            }),
          ],
        },
        platform: 'python',
      });

      expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();
    });
  });
});
