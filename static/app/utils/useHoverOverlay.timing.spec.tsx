import {Fragment, useEffect} from 'react';

import {act, fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

// Disable the NODE_ENV === 'test' instant-open bypass for this file so we can
// drive the real state machine with fake timers. The rest of the tooltip test
// suite keeps the bypass and does not need to be rewritten.
jest.mock('sentry/constants/env', () => ({
  ...jest.requireActual('sentry/constants/env'),
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
      {isOpen && !snapClosed && (
        <div role="tooltip" aria-label={label}>
          Overlay
        </div>
      )}
    </Fragment>
  );
}

function DelayedForceVisibleTrigger({
  forceVisible,
}: {
  forceVisible?: boolean | 'delayed';
}) {
  const {wrapTrigger, isOpen} = useHoverOverlay({
    skipWrapper: true,
    forceVisible,
  });

  return (
    <Fragment>
      {wrapTrigger(<button type="button">Delayed force visible</button>)}
      {isOpen && <div role="tooltip">Overlay</div>}
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
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    unhover(a);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(SKIP_DELAY_WINDOW - 1);

    hover(b);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(OPEN_DELAY);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('cancels a pending open when the user leaves during warmup', () => {
    renderInGroup(<Trigger label="a" />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY - 10);
    unhover(a);

    advance(100);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Group never warmed (we never actually opened) — a fresh hover should
    // still pay the full warmup delay.
    hover(a);
    advance(OPEN_DELAY - 1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    advance(1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('holds a hoverable overlay open for CLOSE_DELAY after unhover', () => {
    renderInGroup(<Trigger label="a" isHoverable />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    unhover(a);
    advance(CLOSE_DELAY - 1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('re-entering during the cooling window keeps the tooltip open', () => {
    renderInGroup(<Trigger label="a" isHoverable />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);

    unhover(a);
    advance(CLOSE_DELAY - 10);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    hover(a);
    advance(CLOSE_DELAY);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => aReset?.());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    hover(b);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Since 'a' never actually opened, 'b' starts cold.
    hover(b);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    advance(OPEN_DELAY);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip', {name: 'a'})).toBeInTheDocument();

    // A goes idle (non-hoverable closes instantly). The consumer still has
    // AnimatePresence exit animating — snapClosed is the signal to unmount it.
    unhover(a);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Within the warm window, hovering B should fire the snap signal on A.
    hover(b);
    expect(screen.queryByRole('tooltip', {name: 'a'})).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', {name: 'b'})).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip', {name: 'a'})).toBeInTheDocument();

    hover(b);
    // A snaps even though it was mid-cooling (still visible).
    expect(screen.queryByRole('tooltip', {name: 'a'})).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', {name: 'b'})).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip', {name: 'b'})).toBeInTheDocument();

    // Advance past where A's hide timer would have fired and past where the
    // resulting stale cooldown would have expired. If the timer weren't
    // cancelled, the group would go cold here while B is still open.
    advance(CLOSE_DELAY + SKIP_DELAY_WINDOW + 10);

    // Move to C via an unhover-then-hover cycle within the warm window.
    unhover(b);
    hover(c);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('does not snap the overlay that is itself opening', () => {
    renderInGroup(<Trigger label="a" />);
    const a = screen.getByRole('button', {name: 'a'});

    hover(a);
    advance(OPEN_DELAY);
    expect(screen.getByRole('tooltip', {name: 'a'})).toBeInTheDocument();
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
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // User moves back to A within the warm window — A should open again and
    // clear its snap flag.
    unhover(b);
    hover(a);
    expect(screen.getByRole('tooltip', {name: 'a'})).toBeInTheDocument();
  });

  it('honors delay=0 even when the group is cold', () => {
    function ZeroDelayTrigger({label}: {label: string}) {
      const {wrapTrigger, isOpen} = useHoverOverlay({skipWrapper: true, delay: 0});
      return (
        <Fragment>
          {wrapTrigger(<button type="button">{label}</button>)}
          {isOpen && <div role="tooltip">Overlay</div>}
        </Fragment>
      );
    }
    renderInGroup(<ZeroDelayTrigger label="a" />);

    hover(screen.getByRole('button', {name: 'a'}));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('honors the open delay for delayed force visibility', () => {
    renderInGroup(<DelayedForceVisibleTrigger forceVisible="delayed" />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(OPEN_DELAY - 1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
