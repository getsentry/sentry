import {act, renderHook} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {matchesHotkey, useHotkeys} from '@sentry/scraps/hotkey';

jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

function dispatchKeyEvent(options: KeyboardEventInit, target = document.body) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('useHotkeys adapter', () => {
  beforeEach(() => {
    isMac.mockReturnValue(false);
  });

  it.each([false, true])(
    'adapts legacy aliases and alternative shortcuts (Mac: %s)',
    mac => {
      isMac.mockReturnValue(mac);
      const callback = jest.fn();
      const match = ['mod+k', '⌘+l'];
      renderHook(() => useHotkeys([{match, callback}]));

      const event = dispatchKeyEvent({key: 'k', ctrlKey: !mac, metaKey: mac});
      dispatchKeyEvent({key: 'l', metaKey: true});

      expect(callback).toHaveBeenCalledTimes(2);
      expect(matchesHotkey(match, event)).toBe(true);
    }
  );

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

  it('keeps duplicate-event handling separate for each hook instance', async () => {
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

  it('maps includeInputs and skipPreventDefault while preserving their defaults', () => {
    const callback = jest.fn();
    const {rerender} = renderHook(
      (options: {includeInputs?: boolean; skipPreventDefault?: boolean}) =>
        useHotkeys([{match: 'k', callback, ...options}]),
      {
        initialProps: {},
      }
    );
    const input = document.createElement('input');
    document.body.append(input);

    const ignoredEvent = dispatchKeyEvent({key: 'k'}, input);
    expect(callback).not.toHaveBeenCalled();
    expect(ignoredEvent.defaultPrevented).toBe(false);

    rerender({includeInputs: true});
    const preventedEvent = dispatchKeyEvent({key: 'k'}, input);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(preventedEvent.defaultPrevented).toBe(true);

    rerender({includeInputs: true, skipPreventDefault: true});
    const handledEvent = dispatchKeyEvent({key: 'k'}, input);
    input.remove();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(handledEvent.defaultPrevented).toBe(false);
  });

  it('does not stop event propagation', () => {
    const callback = jest.fn();
    renderHook(() => useHotkeys([{match: 'k', callback}]));
    const listener = jest.fn();
    window.addEventListener('keydown', listener);

    dispatchKeyEvent({key: 'k'});
    window.removeEventListener('keydown', listener);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('suppresses Escape during IME composition without preventing default', () => {
    const callback = jest.fn();
    renderHook(() => useHotkeys([{match: 'Escape', callback}]));

    const event = dispatchKeyEvent({key: 'Escape', isComposing: true});

    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(matchesHotkey('Escape', event)).toBe(false);
  });

  it('keeps AZERTY zoom available while allowing the slash shortcut', () => {
    isMac.mockReturnValue(true);
    const callback = jest.fn();
    renderHook(() => useHotkeys([{match: 'mod+/', callback}]));

    // AZERTY produces + at the physical Slash position.
    const zoomEvent = dispatchKeyEvent({key: '+', code: 'Slash', metaKey: true});

    expect(callback).not.toHaveBeenCalled();
    expect(zoomEvent.defaultPrevented).toBe(false);
    expect(matchesHotkey('mod+/', zoomEvent)).toBe(false);

    const slashEvent = dispatchKeyEvent({
      key: '/',
      code: 'Period',
      metaKey: true,
      shiftKey: true,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(slashEvent.defaultPrevented).toBe(true);
    expect(matchesHotkey('mod+/', slashEvent)).toBe(true);
  });
});
