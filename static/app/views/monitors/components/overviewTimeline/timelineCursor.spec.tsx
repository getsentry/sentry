import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useTimelineCursor} from './timelineCursor';

function TestComponent() {
  const {timelineCursor, cursorContainerRef} = useTimelineCursor<HTMLDivElement>({
    enabled: true,
    labelText: p => p.toFixed(2),
  });

  return (
    <div data-test-id="body">
      <div data-test-id="container" ref={cursorContainerRef}>
        {timelineCursor}
      </div>
    </div>
  );
}

describe('TimelineCursor', function () {
  it('renders', async function () {
    render(<TestComponent />);

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

    // Cursor has not appeared
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    // Move cursor into the container, cursor is visible
    fireEvent.mouseMove(body, {clientX: 20, clientY: 20});

    const cursor = await screen.findByRole('presentation');
    expect(cursor).toBeInTheDocument();

    // Cursor is 10px into the container
    waitFor(() => {
      expect(container.style.getPropertyValue('--cursorOffset')).toBe('10px');
      expect(container.style.getPropertyValue('--cursorMax')).toBe('100px');
    });

    // move cursor outside it is not visible
    fireEvent.mouseMove(body, {clientX: 120, clientY: 20});
    await waitForElementToBeRemoved(() => screen.getByRole('presentation'));
  });
});
