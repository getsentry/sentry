import {fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import {StacktraceType} from 'app/types/stacktrace';

// @ts-expect-error
const eventEntryStacktrace = TestStubs.EventEntryStacktrace();
// @ts-expect-error
const event = TestStubs.Event({entries: [eventEntryStacktrace]});

const data = eventEntryStacktrace.data as Required<StacktraceType>;

function renderedComponent(
  props: Partial<React.ComponentProps<typeof StacktraceContent>>
) {
  return mountWithTheme(
    <StacktraceContent
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
    const {getByTestId, container} = renderedComponent({});

    // stack trace content
    const stackTraceContent = getByTestId('stack-trace-content');
    expect(stackTraceContent).toBeTruthy();

    // stack trace content has to have a platform icon and a frame list
    expect(stackTraceContent.children).toHaveLength(2);

    // platform icon
    expect(getByTestId('platform-icon-python')).toBeTruthy();

    // frame list
    const frames = getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    expect(container).toSnapshot();
  });

  it('renders the frame in the correct order', function () {
    const {queryAllByTestId} = renderedComponent({});

    // frame - filename
    const frameFilenames = queryAllByTestId('filename');
    expect(frameFilenames).toHaveLength(5);
    expect(frameFilenames[0].textContent).toEqual('raven/scripts/runner.py');
    expect(frameFilenames[1].textContent).toEqual('raven/scripts/runner.py');
    expect(frameFilenames[2].textContent).toEqual('raven/base.py');
    expect(frameFilenames[3].textContent).toEqual('raven/base.py');
    expect(frameFilenames[4].textContent).toEqual('raven/base.py');

    // frame - function
    const frameFunction = queryAllByTestId('function');
    expect(frameFunction).toHaveLength(5);
    expect(frameFunction[0].textContent).toEqual('main');
    expect(frameFunction[1].textContent).toEqual('send_test_message');
    expect(frameFunction[2].textContent).toEqual('captureMessage');
    expect(frameFunction[3].textContent).toEqual('capture');
    expect(frameFunction[4].textContent).toEqual('build_msg');
  });

  it('collapse/expand frames by clicking anywhere in the frame element', function () {
    const {queryAllByTestId, getByTestId} = renderedComponent({});
    // frame list
    const frames = getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    // only one frame is expanded by default
    expect(queryAllByTestId('toggle-button-expanded')).toHaveLength(1);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(4);

    // clickable list item element
    const frameTitles = queryAllByTestId('title');

    // collapse the expanded frame (by default)
    fireEvent.mouseDown(frameTitles[0]);
    fireEvent.click(frameTitles[0]);

    // all frames are now collapsed
    expect(queryAllByTestId('toggle-button-expanded')).toHaveLength(0);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    // expand penultimate and last frame
    fireEvent.mouseDown(frameTitles[frameTitles.length - 2]);
    fireEvent.click(frameTitles[frameTitles.length - 2]);

    fireEvent.mouseDown(frameTitles[frameTitles.length - 1]);
    fireEvent.click(frameTitles[frameTitles.length - 1]);

    // two frames are now collapsed
    expect(queryAllByTestId('toggle-button-expanded')).toHaveLength(2);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(3);
  });

  it('collapse/expand frames by clicking on the toggle button', function () {
    const {queryAllByTestId, getByTestId} = renderedComponent({});

    // frame list
    const frames = getByTestId('frames');
    expect(frames.children).toHaveLength(5);

    const expandedToggleButtons = queryAllByTestId('toggle-button-expanded');

    // only one frame is expanded by default
    expect(expandedToggleButtons).toHaveLength(1);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(4);

    // collapse the expanded frame (by default)
    fireEvent.mouseDown(expandedToggleButtons[0]);
    fireEvent.click(expandedToggleButtons[0]);

    // all frames are now collapsed
    expect(queryAllByTestId('toggle-button-expanded')).toHaveLength(0);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(5);

    const collapsedToggleButtons = queryAllByTestId('toggle-button-collapsed');

    // expand penultimate and last frame
    fireEvent.mouseDown(collapsedToggleButtons[collapsedToggleButtons.length - 2]);
    fireEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 2]);

    fireEvent.mouseDown(collapsedToggleButtons[collapsedToggleButtons.length - 1]);
    fireEvent.click(collapsedToggleButtons[collapsedToggleButtons.length - 1]);

    // two frames are now collapsed
    expect(queryAllByTestId('toggle-button-expanded')).toHaveLength(2);
    expect(queryAllByTestId('toggle-button-collapsed')).toHaveLength(3);
  });

  it('if all in_app equals false, all the frames are showing by default', function () {
    const {getByTestId} = renderedComponent({});

    // frame list
    const frames = getByTestId('frames');
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

      const {queryAllByTestId} = renderedComponent({
        data: newData,
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = queryAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0].textContent).toEqual(
        'Crashed in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1].textContent).toEqual(
        'raven/base.py in build_msg at line 303'
      );
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

      const {queryAllByTestId} = renderedComponent({
        data: newData,
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = queryAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(2);

      expect(frameTitles[0].textContent).toEqual(
        'raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1].textContent).toEqual(
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

      const {queryAllByTestId} = renderedComponent({
        data: newData,
        event: {...event, entries: [{...event.entries[0], stacktrace: newData.frames}]},
        includeSystemFrames: false,
      });

      // clickable list item element
      const frameTitles = queryAllByTestId('title');

      // frame list - in app only
      expect(frameTitles).toHaveLength(3);

      expect(frameTitles[0].textContent).toEqual(
        'Crashed in non-app: raven/scripts/runner.py in main at line 112'
      );
      expect(frameTitles[1].textContent).toEqual('raven/base.py in capture at line 459');
      expect(frameTitles[2].textContent).toEqual(
        'Called from: raven/base.py in build_msg at line 303'
      );
    });
  });
});
