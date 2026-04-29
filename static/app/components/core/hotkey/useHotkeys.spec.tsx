import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useHotkeys} from '@sentry/scraps/hotkey';

jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

function keyToCode(k: string): string {
  if (k === '/') {
    return 'Slash';
  }
  if (k >= 'a' && k <= 'z') {
    return `Key${k.toUpperCase()}`;
  }
  if (k >= '0' && k <= '9') {
    return `Digit${k}`;
  }
  return k;
}

describe('useHotkeys', () => {
  let events: Record<string, (evt: any) => void> = {};

  function makeKeyEventFixture(key: string, options: any = {}) {
    return {
      key,
      code: keyToCode(key),
      preventDefault: jest.fn(),
      ...options,
    };
  }

  beforeEach(() => {
    events = {};

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

  it('matches shift+digit when event.key is the shifted symbol', () => {
    // On US QWERTY, `shift+1` produces `event.key === '!'` but
    // `event.code === 'Digit1'`. The code-arm fallback ensures the shortcut
    // still fires.
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+shift+1', callback}],
    });

    events.keydown!({
      key: '!',
      code: 'Digit1',
      metaKey: true,
      shiftKey: true,
      preventDefault: jest.fn(),
    });

    expect(callback).toHaveBeenCalled();
  });

  it('matches a letter via event.key regardless of physical position', () => {
    // AZERTY user pressing the K-labeled key: `event.key === 'k'` even
    // though the physical position differs from QWERTY.
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+k', callback}],
    });

    events.keydown!({
      key: 'k',
      code: 'KeyK',
      metaKey: true,
      preventDefault: jest.fn(),
    });

    expect(callback).toHaveBeenCalled();
  });

  it('matches a letter via event.code on non-Latin layouts', () => {
    // Cyrillic user pressing the physical K position: `event.key === 'к'`
    // (Cyrillic ka), `event.code === 'KeyK'`. The code-arm fallback fires.
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+k', callback}],
    });

    events.keydown!({
      key: 'к',
      code: 'KeyK',
      metaKey: true,
      preventDefault: jest.fn(),
    });

    expect(callback).toHaveBeenCalled();
  });

  it('matches Escape via event.key', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', callback}],
    });

    events.keydown!({key: 'Escape', code: 'Escape', preventDefault: jest.fn()});

    expect(callback).toHaveBeenCalled();
  });

  it('matches arrow keys via event.key', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'left', callback}],
    });

    events.keydown!({key: 'ArrowLeft', code: 'ArrowLeft', preventDefault: jest.fn()});

    expect(callback).toHaveBeenCalled();
  });

  it('matches vim-style alternatives alongside arrow keys', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['left', 'h'], callback}],
    });

    events.keydown!({key: 'ArrowLeft', code: 'ArrowLeft', preventDefault: jest.fn()});
    expect(callback).toHaveBeenCalledTimes(1);

    events.keydown!({key: 'h', code: 'KeyH', preventDefault: jest.fn()});
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('skips a disabled hotkey without preventing default', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', enabled: false, callback}],
    });

    const evt = makeKeyEventFixture('Escape');
    events.keydown!(evt);

    expect(callback).not.toHaveBeenCalled();
    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  it('respects toggling enabled between renders', () => {
    const callback = jest.fn();

    const {rerender} = renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', enabled: false, callback}],
    });

    events.keydown!(makeKeyEventFixture('Escape'));
    expect(callback).not.toHaveBeenCalled();

    rerender([{match: 'Escape', enabled: true, callback}]);

    events.keydown!(makeKeyEventFixture('Escape'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('matches a letter shortcut even when shift is held (case-insensitive)', () => {
    // `command+shift+k` produces `event.key === 'K'` (uppercase). The
    // implementation must lowercase before comparing to the match string.
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+shift+k', callback}],
    });

    events.keydown!({
      key: 'K',
      code: 'KeyK',
      metaKey: true,
      shiftKey: true,
      preventDefault: jest.fn(),
    });

    expect(callback).toHaveBeenCalled();
  });

  describe('mod modifier', () => {
    afterEach(() => {
      isMac.mockReturnValue(false);
    });

    it('matches command on macOS', () => {
      isMac.mockReturnValue(true);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {metaKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      events.keydown!(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('matches control on non-mac platforms', () => {
      isMac.mockReturnValue(false);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      events.keydown!(makeKeyEventFixture('k', {metaKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('rejects extra non-mod modifiers', () => {
      // mod+k on Mac canonicalizes to command+k; pressing command+ctrl+k
      // should NOT fire because ctrl is an unused modifier.
      isMac.mockReturnValue(true);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {metaKey: true, ctrlKey: true}));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
