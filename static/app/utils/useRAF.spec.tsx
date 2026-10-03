import {useState} from 'react';
import {flushSync} from 'react-dom';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useRAF} from 'sentry/utils/useRAF';

function FrameSubscriber({onFrame, remove}: {onFrame: () => void; remove: () => void}) {
  useRAF(() => {
    onFrame();
    flushSync(remove);
  });
  return <div>Frame subscriber mounted</div>;
}

function TestHarness({onFrame}: {onFrame: () => void}) {
  const [mounted, setMounted] = useState(true);
  return mounted ? (
    <FrameSubscriber onFrame={onFrame} remove={() => setMounted(false)} />
  ) : (
    <div>Frame subscriber removed</div>
  );
}

function DisablingSubscriber({onFrame}: {onFrame: () => void}) {
  const [enabled, setEnabled] = useState(true);
  useRAF(
    () => {
      onFrame();
      flushSync(() => setEnabled(false));
    },
    {enabled}
  );
  return <div>{enabled ? 'Frame subscriber enabled' : 'Frame subscriber disabled'}</div>;
}

describe('useRAF cleanup', () => {
  let frames: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    frames = new Map();
    let nextFrameId = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function advanceFrame() {
    const nextFrame = frames.entries().next().value;
    expect(nextFrame).toBeDefined();
    const [id, callback] = nextFrame!;
    // A browser removes a pending callback before invoking it.
    frames.delete(id);
    act(() => callback(id * 16));
  }

  it('does not reschedule or invoke the callback after synchronous self-unmount', () => {
    const onFrame = jest.fn();
    const {unmount} = render(<TestHarness onFrame={onFrame} />);
    expect(frames.size).toBe(1);

    advanceFrame();
    expect(screen.getByText('Frame subscriber removed')).toBeInTheDocument();
    expect(onFrame).toHaveBeenCalledTimes(1);

    const pendingAfterUnmount = frames.size;
    if (frames.size > 0) {
      advanceFrame();
    }
    if (frames.size > 0) {
      advanceFrame();
    }
    const callsAfterUnmount = onFrame.mock.calls.length;
    unmount();

    expect({pendingAfterUnmount, callsAfterUnmount}).toEqual({
      pendingAfterUnmount: 0,
      callsAfterUnmount: 1,
    });
  });

  it('does not reschedule after the callback synchronously disables polling', () => {
    const onFrame = jest.fn();
    render(<DisablingSubscriber onFrame={onFrame} />);
    expect(frames.size).toBe(1);

    advanceFrame();

    expect(screen.getByText('Frame subscriber disabled')).toBeInTheDocument();
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });
});
