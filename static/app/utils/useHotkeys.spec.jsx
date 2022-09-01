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

  it('simple match', function () {
    let didGetCalled = false;

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() =>
      useHotkeys([
        {
          match: 'ctrl+s',
          callback: () => {
            didGetCalled = true;
          },
        },
      ])
    );

    expect(events.keydown).toBeDefined();
    expect(didGetCalled).toEqual(false);

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(didGetCalled).toEqual(true);
  });

  it('multi match', function () {
    let didGetCalled = false;

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() =>
      useHotkeys([
        {
          match: ['ctrl+s', 'cmd+m'],
          callback: () => {
            didGetCalled = true;
          },
        },
      ])
    );

    expect(events.keydown).toBeDefined();
    expect(didGetCalled).toEqual(false);

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(didGetCalled).toEqual(true);

    didGetCalled = false;

    events.keydown({keyCode: getKeyCode('m'), metaKey: true});

    expect(didGetCalled).toEqual(true);
  });

  it('complex match', function () {
    let didGetCalled = false;

    expect(events.keydown).toBeUndefined();

    reactHooks.renderHook(() =>
      useHotkeys([
        {
          match: ['cmd+control+option+shift+x'],
          callback: () => {
            didGetCalled = true;
          },
        },
      ])
    );

    expect(events.keydown).toBeDefined();
    expect(didGetCalled).toEqual(false);

    events.keydown({
      keyCode: getKeyCode('x'),
      altKey: true,
      metaKey: true,
      shiftKey: true,
      ctrlKey: true,
    });

    expect(didGetCalled).toEqual(true);
  });

  it('rerender', function () {
    let didGetCalled = false;

    expect(events.keydown).toBeUndefined();

    const {rerender} = reactHooks.renderHook(
      p =>
        useHotkeys([
          {
            match: p.match,
            callback: () => {
              didGetCalled = true;
            },
          },
        ]),
      {
        initialProps: {
          match: 'ctrl+s',
        },
      }
    );

    expect(events.keydown).toBeDefined();
    expect(didGetCalled).toEqual(false);

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});

    expect(didGetCalled).toEqual(true);
    didGetCalled = false;

    rerender({match: 'cmd+m'});

    events.keydown({keyCode: getKeyCode('s'), ctrlKey: true});
    expect(didGetCalled).toEqual(false);

    events.keydown({keyCode: getKeyCode('m'), metaKey: true});
    expect(didGetCalled).toEqual(true);
  });
});
