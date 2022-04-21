import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {StacktraceType} from 'sentry/types/stacktrace';

const eventEntryStacktrace = TestStubs.EventEntryStacktrace();
const event = TestStubs.Event({entries: [eventEntryStacktrace]});

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
  it('renders', function () {
    const {container} = renderedComponent({});

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

    expect(container).toSnapshot();
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

  it('collapse/expand frames by clicking anywhere in the frame element', function () {
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
    userEvent.click(frameTitles[0]);

    // all frames are now collapsed
    expect(screen.queryByTestId('toggle-button-expanded')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    // expand penultimate and last frame
    userEvent.click(frameTitles[frameTitles.length - 2]);
    userEvent.click(frameTitles[frameTitles.length - 1]);

    // two frames are now collapsed
    expect(screen.getAllByTestId('toggle-button-expanded')).toHaveLength(2);
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(3);
  });

  it('collapse/expand frames by clicking on the toggle button', function () {
    renderedComponent({});

    // frame list
    const frames = screen.getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    const expandedToggleButtons = screen.getByTestId('toggle-button-expanded');

    // only one frame is expanded by default
    expect(expandedToggleButtons).toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(4);

    // collapse the expanded frame (by default)
    userEvent.click(expandedToggleButtons);

    // all frames are now collapsed
    expect(screen.queryByTestId('toggle-button-expanded')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    const collapsedToggleButtons = screen.getAllByTestId('toggle-button-collapsed');

    // expand penultimate and last frame
    userEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 2]);
    userEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 1]);

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
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
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
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
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
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
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
  });
});
