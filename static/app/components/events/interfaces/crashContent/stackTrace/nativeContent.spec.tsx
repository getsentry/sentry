import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {NativeContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/nativeContent';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventOrGroupType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

const organization = OrganizationFixture();
const project = ProjectFixture();

const integration = GitHubIntegrationFixture();
const repo = RepositoryFixture({integrationId: integration.id});

const config = RepositoryProjectPathConfigFixture({project, repo, integration});

const eventEntryStacktrace = EventEntryStacktraceFixture();
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
describe('Native StackTrace', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: promptResponse,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    ProjectsStore.loadInitialData([project]);
  });
  it('does not render non in app tags', () => {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0]!, inApp: false};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
    });

    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('displays a toggle button when there is more than one non-inapp frame', () => {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0]!, inApp: true};

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

  it('shows/hides frames when toggle button clicked', async () => {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0]!, inApp: true};
    dataFrames[1] = {...dataFrames[1]!, function: 'non-in-app-frame'};
    dataFrames[2] = {...dataFrames[2]!, function: 'non-in-app-frame'};
    dataFrames[3] = {...dataFrames[3]!, function: 'non-in-app-frame'};
    dataFrames[4] = {...dataFrames[4]!, function: 'non-in-app-frame'};

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

  describe('Non-native frames in mixed stacktraces', () => {
    it('hides package and instruction address for Java frames', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'java',
        package: 'com.example.MyClass',
        instructionAddr: '0x00007fff5bf3d000',
        symbolAddr: '0x00007fff5bf3d000',
        function: 'myJavaMethod',
        filename: 'MyClass.java',
        lineNo: 42,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="java-android"
        />,
        {organization}
      );

      // Java frame should show function name but not package or instruction address
      expect(screen.getByText('myJavaMethod')).toBeInTheDocument();
      expect(screen.queryByText('com.example.MyClass')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d000')).not.toBeInTheDocument();
    });

    it('hides package and instruction address for Kotlin frames', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'kotlin',
        package: 'com.example.MyClass',
        instructionAddr: '0x00007fff5bf3d000',
        symbolAddr: '0x00007fff5bf3d000',
        function: 'myKotlinMethod',
        filename: 'MyClass.kt',
        lineNo: 42,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="java-android"
        />,
        {organization}
      );

      // Kotlin frame should show function name but not package or instruction address
      expect(screen.getByText('myKotlinMethod')).toBeInTheDocument();
      expect(screen.queryByText('com.example.MyClass')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d000')).not.toBeInTheDocument();
    });

    it('hides package and instruction address for JavaScript frames', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'javascript',
        package: 'webpack://myapp',
        instructionAddr: '0x00007fff5bf3d000',
        symbolAddr: '0x00007fff5bf3d000',
        function: 'myJsFunction',
        filename: 'app.js',
        lineNo: 42,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="javascript"
        />,
        {organization}
      );

      // JavaScript frame should show function name but not package or instruction address
      expect(screen.getByText('myJsFunction')).toBeInTheDocument();
      expect(screen.queryByText('webpack://myapp')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d000')).not.toBeInTheDocument();
    });

    it('hides package and address even when package is null', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'java',
        package: null,
        instructionAddr: '0x00007fff5bf3d000',
        function: 'javaMethod',
        filename: 'MyClass.java',
        lineNo: 10,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="java-android"
        />,
        {organization}
      );

      // Non-native frame should show function name but not address
      expect(screen.getByText('javaMethod')).toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d000')).not.toBeInTheDocument();
    });

    it('hides package and address for multiple non-native frames', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'java',
        package: 'com.example.ClassA',
        instructionAddr: '0x00007fff5bf3d001',
        function: 'methodA',
        filename: 'ClassA.java',
        lineNo: 10,
        inApp: true,
      };
      dataFrames[1] = {
        ...dataFrames[1]!,
        platform: 'kotlin',
        package: 'com.example.ClassB',
        instructionAddr: '0x00007fff5bf3d002',
        function: 'methodB',
        filename: 'ClassB.kt',
        lineNo: 20,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="java-android"
        />,
        {organization}
      );

      // Both non-native frames should show function names but not packages or addresses
      expect(screen.getByText('methodA')).toBeInTheDocument();
      expect(screen.getByText('methodB')).toBeInTheDocument();
      expect(screen.queryByText('com.example.ClassA')).not.toBeInTheDocument();
      expect(screen.queryByText('com.example.ClassB')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d001')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d002')).not.toBeInTheDocument();
    });

    it('frame.platform overrides event platform', () => {
      const dataFrames = [...data.frames];
      dataFrames[0] = {
        ...dataFrames[0]!,
        platform: 'java', // Frame is Java
        package: 'com.example.MyClass',
        instructionAddr: '0x00007fff5bf3d000',
        function: 'javaMethod',
        filename: 'MyClass.java',
        lineNo: 42,
        inApp: true,
      };

      const newData = {
        ...data,
        frames: dataFrames,
      };

      render(
        <NativeContent
          data={newData}
          event={event}
          newestFirst
          includeSystemFrames
          platform="native" // Event platform is native, but frame overrides
        />,
        {organization}
      );

      // Frame platform (Java) should override event platform (native)
      // So package/address should be hidden
      expect(screen.getByText('javaMethod')).toBeInTheDocument();
      expect(screen.queryByText('com.example.MyClass')).not.toBeInTheDocument();
      expect(screen.queryByText('0x00007fff5bf3d000')).not.toBeInTheDocument();
    });
  });

  it('does not display a toggle button when there is only one non-inapp frame', () => {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0]!, inApp: true};
    dataFrames[2] = {...dataFrames[2]!, inApp: true};
    dataFrames[4] = {...dataFrames[4]!, inApp: true};

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

  it('displays correct icons from frame symbolicatorStatus when image does not exist', () => {
    const newData = {
      ...data,
      frames: [
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.MISSING,
          function: 'missing()',
        }),
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.MISSING_SYMBOL,
          function: 'missing_symbol()',
        }),
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          function: 'symbolicated()',
        }),
      ],
    };

    render(
      <NativeContent
        data={newData}
        platform="cocoa"
        event={event}
        includeSystemFrames
        newestFirst={false}
      />
    );

    const frames = screen.getAllByTestId('stack-trace-frame');

    expect(
      within(frames[0]!).getByTestId('symbolication-error-icon')
    ).toBeInTheDocument();
    expect(
      within(frames[1]!).getByTestId('symbolication-warning-icon')
    ).toBeInTheDocument();
    expect(within(frames[2]!).queryByTestId(/symbolication/)).not.toBeInTheDocument();
  });

  it('expands the first in app frame', () => {
    const newData = {
      ...data,
      frames: [
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.MISSING,
          function: 'missing()',
          inApp: true,
        }),
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.UNKNOWN_IMAGE,
          function: 'unknown_image()',
          inApp: false,
        }),
        EventStacktraceFrameFixture({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          function: 'symbolicated()',
          inApp: true,
        }),
      ],
    };

    render(
      <NativeContent
        data={newData}
        platform="cocoa"
        event={event}
        includeSystemFrames
        newestFirst
      />
    );

    expect(screen.getByRole('button', {name: 'Collapse Context'})).toBeInTheDocument();
    const collapsed = screen.getAllByRole('button', {name: 'Expand Context'});
    expect(collapsed).toHaveLength(2);
  });
});
