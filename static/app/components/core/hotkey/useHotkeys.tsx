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
      for (const hotkey of hotkeysRef.current) {
        if (hotkey.enabled === false) {
          continue;
        }
        const preventDefault = !hotkey.skipPreventDefault;
        const keysets = toArray(hotkey.match).map(keys => keys.toLowerCase());

        for (const keyset of keysets) {
          const keys = keyset.split('+').map(canonicalize);
          const unusedModifiers = MODIFIER_KEYS.filter(
            modifier => !keys.includes(modifier)
          );

          const allKeysPressed =
            keys.every(key => matchesKey(key, evt)) &&
            unusedModifiers.every(modifier => !matchesKey(modifier, evt));

          const inputHasFocus =
            !hotkey.includeInputs && evt.target instanceof HTMLElement
              ? ['textarea', 'input'].includes(evt.target.tagName.toLowerCase())
              : false;

          if (allKeysPressed && !inputHasFocus) {
            if (preventDefault) {
              evt.preventDefault();
            }
            hotkey.callback(evt);
            return;
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
