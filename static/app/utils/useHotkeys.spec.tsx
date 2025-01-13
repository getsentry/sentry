import {renderHook} from 'sentry-test/reactTestingLibrary';

import {getKeyCode} from 'sentry/utils/getKeyCode';
import {useHotkeys} from 'sentry/utils/useHotkeys';

describe('useHotkeys', function () {
  let events: Record<string, (evt: EventListenerOrEventListenerObject) => void> = {};

  function makeKeyEventFixture(keyCode, options) {
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

  it('handles a simple match', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
      initialProps: [{match: 'ctrl+s', callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('handles multiple matches', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
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

  it('handles a complex match', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
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

  it('does not match when extra modifiers are pressed', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
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

  it('updates with rerender', function () {
    const callback = jest.fn();

    const {rerender} = renderHook(p => useHotkeys([{match: p.match, callback}], [p]), {
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

  it('skips input and textarea', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
      initialProps: [{match: ['/'], callback}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not skips input and textarea with includesInputs', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
      initialProps: [{match: ['/'], callback, includeInputs: true}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).toHaveBeenCalled();
  });

  it('skips preventDefault', function () {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p, []), {
      initialProps: [{match: 'ctrl+s', callback, skipPreventDefault: true}],
    });

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });
});
