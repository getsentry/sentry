import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {getKeyCode} from 'sentry/utils/getKeyCode';
import {useHotkeys} from 'sentry/utils/useHotkeys';

describe('useHotkeys', function () {
  let events = {};

  function makeKeyEvent(keyCode, options) {
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
    document.addEventListener = jest.fn((event, callback) => {
      events[event] = callback;
    });

    document.removeEventListener = jest.fn(event => {
      delete events[event];
    });
  });

  it('handles a simple match', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {
      initialProps: [{match: 'ctrl+s', callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    const evt = makeKeyEvent('s', {ctrlKey: true});
    events.keydown(evt);

    expect(evt.preventDefault).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('handles multiple matches', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {
      initialProps: [{match: ['ctrl+s', 'cmd+m'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown(makeKeyEvent('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    events.keydown(makeKeyEvent('m', {metaKey: true}));

    expect(callback).toHaveBeenCalled();
  });

  it('handles a complex match', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {
      initialProps: [{match: ['cmd+control+option+shift+x'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown(
      makeKeyEvent('x', {
        altKey: true,
        metaKey: true,
        shiftKey: true,
        ctrlKey: true,
      })
    );

    expect(callback).toHaveBeenCalled();
  });

  it('updates with rerender', function () {
    const callback = jest.fn();

    const {rerender} = reactHooks.renderHook(
      p => useHotkeys([{match: p.match, callback}]),
      {
        initialProps: {match: 'ctrl+s'},
      }
    );

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown(makeKeyEvent('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    rerender({match: 'cmd+m'});

    events.keydown(makeKeyEvent('s', {ctrlKey: true}));
    expect(callback).not.toHaveBeenCalled();

    events.keydown(makeKeyEvent('m', {metaKey: true}));
    expect(callback).toHaveBeenCalled();
  });

  it('skips input and textarea', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {initialProps: [{match: ['/'], callback}]});

    events.keydown(makeKeyEvent('/', {target: document.createElement('input')}));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not skips input and textarea with includesInputs', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {
      initialProps: [{match: ['/'], callback, includeInputs: true}],
    });

    events.keydown(makeKeyEvent('/', {target: document.createElement('input')}));

    expect(callback).toHaveBeenCalled();
  });

  it('skips preventDefault', function () {
    const callback = jest.fn();

    reactHooks.renderHook(useHotkeys, {
      initialProps: [{match: 'ctrl+s', callback, skipPreventDefault: true}],
    });

    const evt = makeKeyEvent('s', {ctrlKey: true});
    events.keydown(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });
});
