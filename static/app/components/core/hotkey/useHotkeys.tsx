import {useEffect, useRef} from 'react';

import {toArray} from 'sentry/utils/array/toArray';

import {canonicalize, matchesKey, MODIFIER_KEYS} from './keyMappings';

type Hotkey = {
  /**
   * The callback triggered when the matching key is pressed
   */
  callback: (e: KeyboardEvent) => void;
  /**
   * Defines the matching shortcuts.
   *
   * Multiple shortcuts may be passed as a list.
   *
   * The format for shorcuts is `<modifiers>+<key>` For example `shift+t` or
   * `command+shift+t`.
   */
  match: string[] | string;
  /**
   * When `false`, the hotkey is skipped: the callback never fires and
   * `preventDefault` is never called. Useful for gating a hotkey on state
   * (e.g. only intercept `Escape` while a panel is open) without rebuilding
   * the hotkey array. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Allow shortcuts to be triggered while a text input is foccused
   */
  includeInputs?: boolean;
  /**
   * Do not call preventDefault on the keydown event
   */
  skipPreventDefault?: boolean;
};

function shouldIgnoreHotkeyEvent(event: KeyboardEvent): boolean {
  return event.isComposing;
}

/**
 * Returns whether an event should trigger one of the supplied hotkey matches.
 * Uses the same platform-aware modifier and keyboard-layout behavior as
 * useHotkeys, and never matches while an IME is composing text.
 */
export function matchesHotkey(match: string[] | string, event: KeyboardEvent): boolean {
  if (shouldIgnoreHotkeyEvent(event)) {
    return false;
  }

  return toArray(match).some(keyset => {
    const keys = keyset
      .toLowerCase()
      .split('+')
      .map(key => canonicalize(key));
    const unusedModifiers = MODIFIER_KEYS.filter(modifier => !keys.includes(modifier));

    return (
      keys.every(key => matchesKey(key, event)) &&
      unusedModifiers.every(modifier => !matchesKey(modifier, event))
    );
  });
}

/**
 * Pass in the hotkey combinations under match and the corresponding callback
 * function to be called. Separate key names with +. For example,
 * 'command+alt+shift+x'
 *
 * Alternate matchings as an array: ['command+alt+backspace', 'ctrl+alt+delete']
 *
 * Note: you can only use one non-modifier (keys other than shift, ctrl, alt, command) key at a time.
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const hotkeysRef = useRef(hotkeys);

  useEffect(() => {
    hotkeysRef.current = hotkeys;
  });

  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      // Skip IME composition events — event.key may be undefined or 'Process'
      // and hotkeys should never fire while the user is composing a character.
      if (shouldIgnoreHotkeyEvent(evt)) {
        return;
      }
      for (const hotkey of hotkeysRef.current) {
        if (hotkey.enabled === false) {
          continue;
        }
        const preventDefault = !hotkey.skipPreventDefault;
        const inputHasFocus =
          !hotkey.includeInputs && evt.target instanceof HTMLElement
            ? ['textarea', 'input'].includes(evt.target.tagName.toLowerCase())
            : false;

        if (matchesHotkey(hotkey.match, evt) && !inputHasFocus) {
          if (preventDefault) {
            evt.preventDefault();
          }
          hotkey.callback(evt);
          return;
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
