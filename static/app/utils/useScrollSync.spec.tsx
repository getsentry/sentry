import {useRef} from 'react';

// Because of the way that userEvent works, we're unable to use it for these tests, and
// require the use of fireEvent instead.
import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScrollSync} from './useScrollSync';

const mockAddEventListener = jest.fn();

type Direction = 'left' | 'top' | 'all';
function NullRefComponent({direction}: {direction: Direction}) {
  const ref = useRef(null);
  useScrollSync({
    direction,
    // @ts-expect-error - testing null ref
    scrollingRef: {current: null, addEventListener: mockAddEventListener},
    refsToSync: [ref],
  });

  return <div ref={ref} />;
}

function TestComponent({direction}: {direction: Direction}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useScrollSync({
    direction,
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
      render(<NullRefComponent direction="all" />);

      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('refs are set', () => {
    describe('direction is left', () => {
      it('syncs scroll left', async () => {
        render(<TestComponent direction="left" />);

        const textArea = screen.getByRole('textbox');
        fireEvent.scroll(textArea, {
          target: {scrollLeft: 100},
        });

        const overlay = screen.getByTestId('overlay');
        await waitFor(() => expect(overlay.scrollLeft).toBe(100));
      });
    });

    describe('direction is top', () => {
      it('syncs scroll top', async () => {
        render(<TestComponent direction="top" />);

        const textArea = screen.getByRole('textbox');
        fireEvent.scroll(textArea, {
          target: {scrollTop: 100},
        });

        const overlay = screen.getByTestId('overlay');
        await waitFor(() => expect(overlay.scrollTop).toBe(100));
      });
    });

    describe('direction is all', () => {
      it('syncs scroll left and top', async () => {
        render(<TestComponent direction="all" />);

        const textArea = screen.getByRole('textbox');
        fireEvent.scroll(textArea, {
          target: {scrollTop: 100, scrollLeft: 100},
        });

        const overlay = screen.getByTestId('overlay');
        await waitFor(() => expect(overlay.scrollTop).toBe(100));
        expect(overlay.scrollLeft).toBe(100);
      });
    });
  });
});
