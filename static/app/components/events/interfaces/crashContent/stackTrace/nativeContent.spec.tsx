import {Event as EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktrace} from 'sentry-fixture/eventEntryStacktrace';
import {EventStacktraceFrame} from 'sentry-fixture/eventStacktraceFrame';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {NativeContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/nativeContent';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
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
describe('Native StackTrace', function () {
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

  it('displays correct icons from frame symbolicatorStatus when image does not exist', function () {
    const newData = {
      ...data,
      frames: [
        EventStacktraceFrame({
          symbolicatorStatus: SymbolicatorStatus.MISSING,
          function: 'missing()',
        }),
        EventStacktraceFrame({
          symbolicatorStatus: SymbolicatorStatus.UNKNOWN_IMAGE,
          function: 'unknown_image()',
        }),
        EventStacktraceFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          function: 'symbolicated()',
        }),
      ],
    };

    render(
      <NativeContent data={newData} platform="cocoa" event={event} includeSystemFrames />
    );

    const frames = screen.getAllByTestId('stack-trace-frame');

    expect(within(frames[0]).getByTestId('symbolication-error-icon')).toBeInTheDocument();
    expect(
      within(frames[1]).getByTestId('symbolication-warning-icon')
    ).toBeInTheDocument();
    expect(within(frames[2]).queryByTestId(/symbolication/)).not.toBeInTheDocument();
  });
});
