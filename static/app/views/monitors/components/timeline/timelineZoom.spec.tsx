import {act, fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTimelineZoom} from './timelineZoom';

interface TestProps {
  onSelect?: (startX: number, endX: number) => void;
}

function TestComponent({onSelect}: TestProps) {
  const {isActive, timelineSelector, selectionContainerRef} =
    useTimelineZoom<HTMLDivElement>({enabled: true, onSelect});

  return (
    <div data-test-id="body">
      {isActive && <div>Selection Active</div>}
      <div data-test-id="container" ref={selectionContainerRef}>
        {timelineSelector}
      </div>
    </div>
  );
}

beforeEach(() => {
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    });
});

afterEach(() => {
  jest.mocked(window.requestAnimationFrame).mockRestore();
});

function setupTestComponent() {
  const handleSelect = jest.fn();

  render(<TestComponent onSelect={handleSelect} />);

  const body = screen.getByTestId('body');
  const container = screen.getByTestId('container');

  container.getBoundingClientRect = jest.fn(() => ({
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    left: 10,
    top: 10,
    right: 110,
    bottom: 110,
    toJSON: jest.fn(),
  }));

  return {handleSelect, body, container};
}

describe('TimelineZoom', function () {
  it('triggers onSelect', async function () {
    const {handleSelect, body, container} = setupTestComponent();

    // Selector has not appeared
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    // Selection does not start when clicking outside the container
    act(() => fireEvent.mouseDown(body, {button: 0, clientX: 0, clientY: 0}));
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    // Move cursor into the container, selection still not present
    act(() => fireEvent.mouseMove(body, {clientX: 20, clientY: 20}));
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    // Left click starts selection
    act(() => fireEvent.mouseDown(body, {button: 0, clientX: 20, clientY: 20}));

    const selection = screen.getByRole('presentation');
    expect(selection).toBeInTheDocument();
    expect(screen.getByText('Selection Active')).toBeInTheDocument();

    expect(container.style.getPropertyValue('--selectionStart')).toBe('10px');
    expect(container.style.getPropertyValue('--selectionWidth')).toBe('0px');

    // Body has disabled text selection
    expect(document.body).toHaveStyle({userSelect: 'none'});

    // Move right 15px
    act(() => fireEvent.mouseMove(body, {clientX: 35, clientY: 20}));
    expect(container.style.getPropertyValue('--selectionWidth')).toBe('15px');

    // Move left 25px, at the edge of the container
    act(() => fireEvent.mouseMove(body, {clientX: 10, clientY: 20}));
    expect(container.style.getPropertyValue('--selectionStart')).toBe('0px');
    expect(container.style.getPropertyValue('--selectionWidth')).toBe('10px');

    // Move left 5px more, selection does not move out of the container
    act(() => fireEvent.mouseMove(body, {clientX: 5, clientY: 20}));
    expect(container.style.getPropertyValue('--selectionStart')).toBe('0px');
    expect(container.style.getPropertyValue('--selectionWidth')).toBe('10px');

    // Release to make selection
    act(() => {
      fireEvent.mouseUp(body, {clientX: 5, clientY: 20});
    });
    await waitFor(() => {
      expect(handleSelect).toHaveBeenCalledWith(0, 10);
    });
  });

  it('does not start selection with right click', function () {
    const {body} = setupTestComponent();

    // Move cursor into the container, selection still not present
    fireEvent.mouseMove(body, {clientX: 20, clientY: 20});

    // Right click does nothing
    fireEvent.mouseDown(body, {button: 1, clientX: 20, clientY: 20});
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('does not select for very small regions', async function () {
    const {handleSelect, body, container} = setupTestComponent();

    // Left click starts selection
    act(() => fireEvent.mouseMove(body, {clientX: 20, clientY: 20}));
    act(() => fireEvent.mouseDown(body, {button: 0, clientX: 20, clientY: 20}));
    act(() => fireEvent.mouseMove(body, {clientX: 22, clientY: 20}));

    const selection = screen.getByRole('presentation');
    expect(selection).toBeInTheDocument();
    expect(screen.getByText('Selection Active')).toBeInTheDocument();

    expect(container.style.getPropertyValue('--selectionStart')).toBe('10px');
    expect(container.style.getPropertyValue('--selectionWidth')).toBe('2px');

    // Relase does not make selection for such a small range
    act(() => fireEvent.mouseUp(body, {clientX: 22, clientY: 20}));

    // Can't wait for the handleSelect to be called, as it's not called
    await act(tick);
    expect(handleSelect).not.toHaveBeenCalledWith(0, 10);
  });
});
