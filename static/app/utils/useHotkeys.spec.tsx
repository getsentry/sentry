import {renderHook} from 'sentry-test/reactTestingLibrary';

import {getKeyCode} from 'sentry/utils/getKeyCode';
import {useHotkeys} from 'sentry/utils/useHotkeys';

describe('useHotkeys', () => {
  let events: Record<string, (evt: EventListenerOrEventListenerObject) => void> = {};

  function makeKeyEventFixture(keyCode: any, options: any) {
    return {
      keyCode: getKeyCode(keyCode),
      preventDefault: jest.fn(),
      ...options,
    };
  }

  beforeEach(() => {
    // Empty our events before each test case
    events = {};

    // Define the addEventListener method with a Jest mock function
    document.addEventListener = jest.fn((event: string, callback: () => any) => {
      events[event] = callback;
    });

    document.removeEventListener = jest.fn(event => {
      delete events[event];
    });
  });

  it('handles a simple match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('handles multiple matches', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['ctrl+s', 'command+m'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    events.keydown!(makeKeyEventFixture('m', {metaKey: true}));

    expect(callback).toHaveBeenCalled();
  });

  it('handles a complex match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['command+ctrl+alt+shift+x'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(
      makeKeyEventFixture('x', {
        altKey: true,
        metaKey: true,
        shiftKey: true,
        ctrlKey: true,
      })
    );

    expect(callback).toHaveBeenCalled();
  });

  it('does not match when extra modifiers are pressed', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['command+shift+x'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(
      makeKeyEventFixture('x', {
        altKey: true,
        metaKey: true,
        shiftKey: true,
        ctrlKey: true,
      })
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('updates with rerender', () => {
    const callback = jest.fn();

    const {rerender} = renderHook(p => useHotkeys([{match: p.match, callback}]), {
      initialProps: {match: 'ctrl+s'},
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    rerender({match: 'command+m'});

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('m', {metaKey: true}));
    expect(callback).toHaveBeenCalled();
  });

  it('skips input and textarea', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not skips input and textarea with includesInputs', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback, includeInputs: true}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).toHaveBeenCalled();
  });

  it('registers on capture phase with useCapture', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+k', callback, useCapture: true}],
    });

    expect(document.addEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
      true
    );

    const captureCall = (document.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'keydown' && call[2] === true
    );
    expect(captureCall).toBeDefined();

    const captureHandler = captureCall[1];
    const evt = makeKeyEventFixture('k', {metaKey: true});
    captureHandler(evt);

    expect(callback).toHaveBeenCalled();
  });

  it('does not fire capture hotkeys on bubble phase', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+k', callback, useCapture: true}],
    });

    const bubbleCall = (document.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'keydown' && call[2] !== true
    );
    expect(bubbleCall).toBeDefined();

    const bubbleHandler = bubbleCall[1];
    const evt = makeKeyEventFixture('k', {metaKey: true});
    bubbleHandler(evt);

    expect(callback).not.toHaveBeenCalled();
  });

  it('skips preventDefault', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback, skipPreventDefault: true}],
    });

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });
});
