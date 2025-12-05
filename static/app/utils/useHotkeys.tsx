import {useEffect, useRef} from 'react';

import toArray from 'sentry/utils/array/toArray';

import {getKeyCode} from './getKeyCode';

const isKeyPressed = (key: string, evt: KeyboardEvent): boolean => {
  const normalizedKey = key.toLowerCase();

  switch (normalizedKey) {
    case 'command':
    case 'cmd':
    case '⌘':
      return evt.metaKey;
    case 'shift':
    case '⇧':
      return evt.shiftKey;
    case 'ctrl':
    case 'control':
    case '⌃':
      return evt.ctrlKey;
    case 'alt':
    case 'option':
    case '⌥':
      return evt.altKey;
    default: {
      // Use evt.key for better keyboard layout support (works with German keyboards, etc.)
      // Fall back to keyCode for backwards compatibility with special keys
      if (evt.key && evt.key.toLowerCase() === normalizedKey) {
        return true;
      }
      const keyCode = getKeyCode(key);
      return keyCode === evt.keyCode;
    }
  }
};

const modifiers = ['command', 'shift', 'ctrl', 'alt'];

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
        const preventDefault = !hotkey.skipPreventDefault;
        const keysets = toArray(hotkey.match).map(keys => keys.toLowerCase());

        for (const keyset of keysets) {
          const keys = keyset.split('+');
          const unusedModifiers = modifiers.filter(modifier => !keys.includes(modifier));

          const allKeysPressed =
            keys.every(key => isKeyPressed(key, evt)) &&
            unusedModifiers.every(modifier => !isKeyPressed(modifier, evt));

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
