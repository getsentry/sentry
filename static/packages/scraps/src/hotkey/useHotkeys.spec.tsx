import {act, renderHook} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {matchesHotkey, useHotkeys} from '@sentry/scraps/hotkey';

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
  function makeKeyEventFixture(key: string, options: KeyboardEventInit = {}) {
    return new KeyboardEvent('keydown', {
      key,
      code: keyToCode(key),
      bubbles: true,
      cancelable: true,
      ...options,
    });
  }

  function dispatchKeyEvent(
    event: KeyboardEvent | KeyboardEventInit,
    target = document.body
  ) {
    const keyboardEvent =
      event instanceof KeyboardEvent
        ? event
        : makeKeyEventFixture(event.key ?? '', event);
    act(() => {
      target.dispatchEvent(keyboardEvent);
    });
    return keyboardEvent;
  }

  beforeEach(() => {
    isMac.mockReturnValue(false);
  });

  it('handles a simple match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback}],
    });

    expect(callback).not.toHaveBeenCalled();

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    dispatchKeyEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
    expect(callback).toHaveBeenCalled();
  });

  it('does not match while an IME is composing text', () => {
    expect(
      matchesHotkey('mod+k', makeKeyEventFixture('k', {ctrlKey: true, isComposing: true}))
    ).toBe(false);
  });

  it('handles multiple matches', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['ctrl+s', 'command+m'], callback}],
    });

    expect(callback).not.toHaveBeenCalled();

    dispatchKeyEvent(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    dispatchKeyEvent(makeKeyEventFixture('m', {metaKey: true}));

    expect(callback).toHaveBeenCalled();
  });

  it('handles a complex match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['command+ctrl+alt+shift+x'], callback}],
    });

    expect(callback).not.toHaveBeenCalled();

    dispatchKeyEvent(
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

    expect(callback).not.toHaveBeenCalled();

    dispatchKeyEvent(
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

    expect(callback).not.toHaveBeenCalled();

    dispatchKeyEvent(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    rerender({match: 'command+m'});

    dispatchKeyEvent(makeKeyEventFixture('s', {ctrlKey: true}));
    expect(callback).not.toHaveBeenCalled();

    dispatchKeyEvent(makeKeyEventFixture('m', {metaKey: true}));
    expect(callback).toHaveBeenCalled();
  });

  it.each(['input', 'textarea'])('skips %s', tagName => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback}],
    });

    const input = document.createElement(tagName);
    document.body.append(input);
    dispatchKeyEvent(makeKeyEventFixture('/'), input);
    input.remove();

    expect(callback).not.toHaveBeenCalled();
  });

  it.each(['input', 'textarea'])('handles %s with includeInputs', tagName => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback, includeInputs: true}],
    });

    const input = document.createElement(tagName);
    document.body.append(input);
    dispatchKeyEvent(makeKeyEventFixture('/'), input);
    input.remove();

    expect(callback).toHaveBeenCalled();
  });

  it.each([false, true])(
    'only handles shortcuts in editable content when includeInputs is %s',
    includeInputs => {
      const callback = jest.fn();
      const target = document.createElement('div');
      target.contentEditable = 'plaintext-only';
      // jsdom does not implement the browser's isContentEditable property.
      Object.defineProperty(target, 'isContentEditable', {value: true});
      renderHook(p => useHotkeys(p), {
        initialProps: [{match: '/', callback, includeInputs}],
      });
      document.body.append(target);
      const evt = makeKeyEventFixture('/');

      dispatchKeyEvent(evt, target);
      target.remove();

      expect(callback).toHaveBeenCalledTimes(includeInputs ? 1 : 0);
      expect(evt.defaultPrevented).toBe(includeInputs);
    }
  );

  it('skips preventDefault', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback, skipPreventDefault: true}],
    });

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    dispatchKeyEvent(evt);

    expect(evt.defaultPrevented).toBe(false);
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

    dispatchKeyEvent({
      key: '!',
      code: 'Digit1',
      metaKey: true,
      shiftKey: true,
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

    dispatchKeyEvent({
      key: 'k',
      code: 'KeyK',
      metaKey: true,
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

    dispatchKeyEvent({
      key: 'к',
      code: 'KeyK',
      metaKey: true,
    });

    expect(callback).toHaveBeenCalled();
  });

  it.each([
    {key: '/', code: 'Slash', shiftKey: false},
    {key: '.', code: 'Period', shiftKey: false},
    {key: '/', code: 'Digit7', shiftKey: true},
    {key: '/', code: 'Period', shiftKey: true},
    {key: '/', code: 'Minus', shiftKey: true},
  ])('handles the slash alternatives once for $code (Shift: $shiftKey)', options => {
    const callback = jest.fn();
    const match = ['mod+/', 'mod+.', 'mod+shift+7', 'mod+shift+.', 'mod+shift+-'];
    renderHook(() => useHotkeys([{match, callback}]));

    const event = dispatchKeyEvent({...options, ctrlKey: true});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(matchesHotkey(match, event)).toBe(true);
  });

  it('matches Escape via event.key', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', callback}],
    });

    dispatchKeyEvent({key: 'Escape', code: 'Escape'});

    expect(callback).toHaveBeenCalled();
  });

  it('matches arrow keys via event.key', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'left', callback}],
    });

    dispatchKeyEvent({key: 'ArrowLeft', code: 'ArrowLeft'});

    expect(callback).toHaveBeenCalled();
  });

  it('matches vim-style alternatives alongside arrow keys', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['left', 'h'], callback}],
    });

    dispatchKeyEvent({key: 'ArrowLeft', code: 'ArrowLeft'});
    expect(callback).toHaveBeenCalledTimes(1);

    dispatchKeyEvent({key: 'h', code: 'KeyH'});
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('skips a disabled hotkey without preventing default', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', enabled: false, callback}],
    });

    const evt = makeKeyEventFixture('Escape');
    dispatchKeyEvent(evt);

    expect(callback).not.toHaveBeenCalled();
    expect(evt.defaultPrevented).toBe(false);
  });

  it('respects toggling enabled between renders', () => {
    const callback = jest.fn();

    const {rerender} = renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'Escape', enabled: false, callback}],
    });

    dispatchKeyEvent(makeKeyEventFixture('Escape'));
    expect(callback).not.toHaveBeenCalled();

    rerender([{match: 'Escape', enabled: true, callback}]);

    dispatchKeyEvent(makeKeyEventFixture('Escape'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('matches a letter shortcut even when shift is held (case-insensitive)', () => {
    // `command+shift+k` produces `event.key === 'K'` (uppercase). The
    // implementation must lowercase before comparing to the match string.
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'command+shift+k', callback}],
    });

    dispatchKeyEvent({
      key: 'K',
      code: 'KeyK',
      metaKey: true,
      shiftKey: true,
    });

    expect(callback).toHaveBeenCalled();
  });

  it('does not match mod+/ on AZERTY when user presses Cmd++ (physical Slash key)', () => {
    // On AZERTY, the physical key in the Slash position produces '+'.
    // event.key is '+', event.code is 'Slash'.
    // mod+/ should NOT fire because the user typed Cmd++ (zoom in),
    // not Cmd+/. The event.code fallback must not treat '+' as '/'.
    isMac.mockReturnValue(true);
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'mod+/', callback, includeInputs: true}],
    });

    const evt = makeKeyEventFixture('+', {code: 'Slash', metaKey: true});
    dispatchKeyEvent(evt);

    expect(callback).not.toHaveBeenCalled();
    expect(evt.defaultPrevented).toBe(false);

    isMac.mockReturnValue(false);
  });

  it.each(['k', 'Escape'])('ignores %s during IME composition', key => {
    const callback = jest.fn();
    renderHook(() => useHotkeys([{match: key, callback}]));

    const event = dispatchKeyEvent(makeKeyEventFixture(key, {isComposing: true}));

    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('uses the latest callback', async () => {
    const firstCallback = jest.fn();
    const nextCallback = jest.fn();
    const {rerender} = renderHook(callback => useHotkeys([{match: 'k', callback}]), {
      initialProps: firstCallback,
    });

    await userEvent.keyboard('k');
    rerender(nextCallback);
    await userEvent.keyboard('k');

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(nextCallback).toHaveBeenCalledTimes(1);
  });

  it('only calls the first enabled match once per key press', async () => {
    const disabledCallback = jest.fn();
    const firstCallback = jest.fn();
    const lastCallback = jest.fn();
    renderHook(() =>
      useHotkeys([
        {match: 'k', callback: disabledCallback, enabled: false},
        {match: ['k', 'k'], callback: firstCallback},
        {match: 'k', callback: lastCallback},
      ])
    );

    await userEvent.keyboard('kk');

    expect(disabledCallback).not.toHaveBeenCalled();
    expect(firstCallback).toHaveBeenCalledTimes(2);
    expect(lastCallback).not.toHaveBeenCalled();
  });

  it('allows separate hook instances to handle the same key', async () => {
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    renderHook(() => {
      useHotkeys([{match: 'k', callback: firstCallback}]);
      useHotkeys([{match: 'k', callback: secondCallback}]);
    });

    await userEvent.keyboard('k');

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it('removes shortcuts when the list becomes empty', async () => {
    const callback = jest.fn();
    const {rerender} = renderHook(hotkeys => useHotkeys(hotkeys), {
      initialProps: [{match: 'k', callback}],
    });

    await userEvent.keyboard('k');
    rerender([]);
    const event = dispatchKeyEvent(makeKeyEventFixture('k'));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('removes shortcuts on unmount', () => {
    const callback = jest.fn();
    const {unmount} = renderHook(() => useHotkeys([{match: 'k', callback}]));

    unmount();
    const event = dispatchKeyEvent(makeKeyEventFixture('k'));

    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('updates input and preventDefault options', () => {
    const callback = jest.fn();
    const {rerender} = renderHook(
      options => useHotkeys([{match: 'k', callback, ...options}]),
      {
        initialProps: {includeInputs: false, skipPreventDefault: false},
      }
    );
    const input = document.createElement('input');
    document.body.append(input);

    const ignoredEvent = dispatchKeyEvent(makeKeyEventFixture('k'), input);
    expect(callback).not.toHaveBeenCalled();
    expect(ignoredEvent.defaultPrevented).toBe(false);

    rerender({includeInputs: true, skipPreventDefault: true});
    const handledEvent = dispatchKeyEvent(makeKeyEventFixture('k'), input);
    input.remove();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(handledEvent.defaultPrevented).toBe(false);
  });

  it('does not stop event propagation', () => {
    const callback = jest.fn();
    renderHook(() => useHotkeys([{match: 'k', callback}]));

    const event = makeKeyEventFixture('k');
    const stopPropagation = jest.spyOn(event, 'stopPropagation');
    dispatchKeyEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(stopPropagation).not.toHaveBeenCalled();
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

      dispatchKeyEvent(makeKeyEventFixture('k', {metaKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      dispatchKeyEvent(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('matches control on non-mac platforms', () => {
      isMac.mockReturnValue(false);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      dispatchKeyEvent(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      dispatchKeyEvent(makeKeyEventFixture('k', {metaKey: true}));
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

      dispatchKeyEvent(makeKeyEventFixture('k', {metaKey: true, ctrlKey: true}));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
