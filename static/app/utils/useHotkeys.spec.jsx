import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {getKeyCode} from 'sentry/utils/getKeyCode';
import {useHotkeys} from 'sentry/utils/useHotkeys';

describe('useHotkeys', function () {
  let events = {};

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

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() => useHotkeys([{match: 'ctrl+s', callback}]));

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(callback).toHaveBeenCalled();
  });

  it('handles multiple matches', function () {
    const callback = jest.fn();

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() => useHotkeys([{match: ['ctrl+s', 'cmd+m'], callback}]));

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    events.keydown({keyCode: getKeyCode('m'), metaKey: true});

    expect(callback).toHaveBeenCalled();
  });

  it('handles a complex match', function () {
    const callback = jest.fn();

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() =>
      useHotkeys([{match: ['cmd+control+option+shift+x'], callback}])
    );

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown({
      keyCode: getKeyCode('x'),
      altKey: true,
      metaKey: true,
      shiftKey: true,
      ctrlKey: true,
    });

    expect(callback).toHaveBeenCalled();
  });

  it('rerender', function () {
    const callback = jest.fn();

    expect(events.keydown).toBeUndefined();

    const {rerender} = reactHooks.renderHook(
      p => useHotkeys([{match: p.match, callback}]),
      {
        initialProps: {match: 'ctrl+s'},
      }
    );

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    rerender({match: 'cmd+m'});

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});
    expect(callback).not.toHaveBeenCalled();

    events.keydown({keyCode: getKeyCode('m'), metaKey: true});
    expect(callback).toHaveBeenCalled();
  });

  it('skips input and textarea', function () {});
});
