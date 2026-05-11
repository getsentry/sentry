import {Fragment, useEffect} from 'react';

import {act, fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

// Disable the NODE_ENV === 'test' instant-open bypass for this file so we can
// drive the real state machine with fake timers. The rest of the tooltip test
// suite keeps the bypass and does not need to be rewritten.
jest.mock('sentry/constants', () => ({
  ...jest.requireActual('sentry/constants'),
  NODE_ENV: 'production',
}));

import {HoverOverlayGroupProvider, useHoverOverlay} from 'sentry/utils/useHoverOverlay';

const OPEN_DELAY = 400;
const CLOSE_DELAY = 150;
const SKIP_DELAY_WINDOW = 600;

function Trigger({
  label,
  isHoverable,
  onResetReady,
}: {
  label: string;
  isHoverable?: boolean;
  onResetReady?: (reset: () => void) => void;
}) {
  const {wrapTrigger, isOpen, snapClosed, reset} = useHoverOverlay({
    skipWrapper: true,
    isHoverable,
  });

  useEffect(() => {
    onResetReady?.(reset);
  }, [onResetReady, reset]);

  return (
    <Fragment>
      {wrapTrigger(<button type="button">{label}</button>)}
      <span data-test-id={`state-${label}`}>{isOpen ? 'open' : 'closed'}</span>
      <span data-test-id={`snap-${label}`}>{snapClosed ? 'snap' : 'flow'}</span>
    </Fragment>
  );
}

describe('useHoverOverlay timing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  // Each render is scoped to its own <HoverOverlayGroupProvider>, so group
  // state (warmth, snap-close listeners, pending cool-down timers) is
  // isolated per test without reaching into module internals.
  function renderInGroup(ui: React.ReactElement) {
    return render(ui, {wrapper: HoverOverlayGroupProvider});
  }

  function hover(el: HTMLElement) {
    fireEvent.pointerEnter(el);
  }
  function unhover(el: HTMLElement) {
    fireEvent.pointerLeave(el);
  }
  function advance(ms: number) {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('waits OPEN_DELAY before opening on a cold hover', () => {
    renderInGroup(<Trigger label="a" />);

    hover(screen.getByRole('button', {name: 'a'}));

    advance(OPEN_DELAY - 1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');

    advance(1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
  });

  it('stays warm for SKIP_DELAY_WINDOW after a tooltip closes — neighbor opens instantly', () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" />
        <Trigger label="b" />
      </Fragment>
    );

    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    unhover(a);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');

    advance(SKIP_DELAY_WINDOW - 1);

    hover(b);
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
  });

  it('goes cold after SKIP_DELAY_WINDOW with no new hover', () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" />
        <Trigger label="b" />
      </Fragment>
    );

    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);
    unhover(a);

    advance(SKIP_DELAY_WINDOW + 1);

    hover(b);
    expect(screen.getByTestId('state-b')).toHaveTextContent('closed');

    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
  });

  it('cancels a pending open when the user leaves during warmup', () => {
    renderInGroup(<Trigger label="a" />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY - 10);
    unhover(a);

    advance(100);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');

    // Group never warmed (we never actually opened) — a fresh hover should
    // still pay the full warmup delay.
    hover(a);
    advance(OPEN_DELAY - 1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');
    advance(1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
  });

  it('holds a hoverable overlay open for CLOSE_DELAY after unhover', () => {
    renderInGroup(<Trigger label="a" isHoverable />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    unhover(a);
    advance(CLOSE_DELAY - 1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    advance(1);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');
  });

  it('re-entering during the cooling window keeps the tooltip open', () => {
    renderInGroup(<Trigger label="a" isHoverable />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);

    unhover(a);
    advance(CLOSE_DELAY - 10);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    hover(a);
    advance(CLOSE_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
  });

  it('reset() while open starts the group cooldown so neighbors open instantly', () => {
    let aReset: (() => void) | undefined;
    renderInGroup(
      <Fragment>
        <Trigger label="a" onResetReady={fn => (aReset = fn)} />
        <Trigger label="b" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    act(() => aReset?.());
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');

    hover(b);
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
  });

  it('reset() during warmup cancels the pending open and leaves the group cold', () => {
    let aReset: (() => void) | undefined;
    renderInGroup(
      <Fragment>
        <Trigger label="a" onResetReady={fn => (aReset = fn)} />
        <Trigger label="b" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY - 100);
    act(() => aReset?.());
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');

    // Since 'a' never actually opened, 'b' starts cold.
    hover(b);
    expect(screen.getByTestId('state-b')).toHaveTextContent('closed');
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
  });

  it('snap-closes a non-hoverable sibling when a neighbor opens via warm-skip', () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" />
        <Trigger label="b" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
    expect(screen.getByTestId('snap-a')).toHaveTextContent('flow');

    // A goes idle (non-hoverable closes instantly). The consumer still has
    // AnimatePresence exit animating — snapClosed is the signal to unmount it.
    unhover(a);
    expect(screen.getByTestId('state-a')).toHaveTextContent('closed');
    expect(screen.getByTestId('snap-a')).toHaveTextContent('flow');

    // Within the warm window, hovering B should fire the snap signal on A.
    hover(b);
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
    expect(screen.getByTestId('snap-a')).toHaveTextContent('snap');
    expect(screen.getByTestId('snap-b')).toHaveTextContent('flow');
  });

  it('snap-closes a hoverable sibling that is still in its cooling window', () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" isHoverable />
        <Trigger label="b" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);

    // A is hoverable — unhover puts it in cooling, not idle.
    unhover(a);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');

    hover(b);
    // A snaps even though it was mid-cooling (still visible).
    expect(screen.getByTestId('snap-a')).toHaveTextContent('snap');
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');
  });

  it("does not let a snap-closed cooling overlay's hide timer cool the group", () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" isHoverable />
        <Trigger label="b" />
        <Trigger label="c" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});
    const c = screen.getByRole('button', {name: 'c'});

    hover(a);
    advance(OPEN_DELAY);
    unhover(a); // A goes cooling with a pending hide timer.

    hover(b); // Snaps A; the stale hide timer must be cancelled.
    expect(screen.getByTestId('state-b')).toHaveTextContent('open');

    // Advance past where A's hide timer would have fired and past where the
    // resulting stale cooldown would have expired. If the timer weren't
    // cancelled, the group would go cold here while B is still open.
    advance(CLOSE_DELAY + SKIP_DELAY_WINDOW + 10);

    // Move to C via an unhover-then-hover cycle within the warm window.
    unhover(b);
    hover(c);
    expect(screen.getByTestId('state-c')).toHaveTextContent('open');
  });

  it('does not snap the overlay that is itself opening', () => {
    renderInGroup(<Trigger label="a" />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
    expect(screen.getByTestId('snap-a')).toHaveTextContent('flow');
  });

  it('resets snap when the snapped overlay is re-hovered', () => {
    renderInGroup(
      <Fragment>
        <Trigger label="a" />
        <Trigger label="b" />
      </Fragment>
    );
    const a = screen.getByRole('button', {name: 'a'});
    const b = screen.getByRole('button', {name: 'b'});

    hover(a);
    advance(OPEN_DELAY);
    unhover(a);
    hover(b);
    expect(screen.getByTestId('snap-a')).toHaveTextContent('snap');

    // User moves back to A within the warm window — A should open again and
    // clear its snap flag.
    unhover(b);
    hover(a);
    expect(screen.getByTestId('snap-a')).toHaveTextContent('flow');
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
  });

  it('honors delay=0 even when the group is cold', () => {
    function ZeroDelayTrigger({label}: {label: string}) {
      const {wrapTrigger, isOpen} = useHoverOverlay({skipWrapper: true, delay: 0});
      return (
        <Fragment>
          {wrapTrigger(<button type="button">{label}</button>)}
          <span data-test-id={`state-${label}`}>{isOpen ? 'open' : 'closed'}</span>
        </Fragment>
      );
    }
    renderInGroup(<ZeroDelayTrigger label="a" />);

    hover(screen.getByRole('button', {name: 'a'}));
    expect(screen.getByTestId('state-a')).toHaveTextContent('open');
  });
});
