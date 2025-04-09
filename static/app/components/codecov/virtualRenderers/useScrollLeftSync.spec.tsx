import {useRef} from 'react';

// Because of the way that userEvent works, we're unable to use it for these tests, and
// require the use of fireEvent instead.
import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScrollLeftSync} from './useScrollLeftSync';

const mockAddEventListener = jest.fn();

function NullRefComponent() {
  const ref = useRef(null);
  useScrollLeftSync({
    // @ts-expect-error - testing null ref
    scrollingRef: {current: null, addEventListener: mockAddEventListener},
    refsToSync: [ref],
  });

  return <div ref={ref} />;
}

function TestComponent() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useScrollLeftSync({
    scrollingRef: textAreaRef,
    refsToSync: [overlayRef],
  });

  return (
    <div>
      <textarea ref={textAreaRef} data-test-id="text-area" />
      <div ref={overlayRef} data-test-id="overlay" />
    </div>
  );
}

describe('useLeftScrollSync', () => {
  describe('refs are null', () => {
    it('early returns', () => {
      render(<NullRefComponent />);

      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('refs are set', () => {
    it('syncs scroll left', async () => {
      render(<TestComponent />);

      const textArea = screen.getByTestId('text-area');
      fireEvent.scroll(textArea, {
        target: {scrollLeft: 100},
      });

      const overlay = screen.getByTestId('overlay');
      await waitFor(() => expect(overlay.scrollLeft).toBe(100));
    });
  });
});
