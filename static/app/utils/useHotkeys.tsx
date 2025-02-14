import {useCallback, useEffect} from 'react';

import toArray from 'sentry/utils/array/toArray';

import {getKeyCode} from './getKeyCode';

const isKeyPressed = (key: string, evt: KeyboardEvent): boolean => {
  const keyCode = getKeyCode(key);
  switch (keyCode) {
    case getKeyCode('command'):
      return evt.metaKey;
    case getKeyCode('shift'):
      return evt.shiftKey;
    case getKeyCode('ctrl'):
      return evt.ctrlKey;
    case getKeyCode('alt'):
      return evt.altKey;
    default:
      return keyCode === evt.keyCode;
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
  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      for (const hotkey of hotkeys) {
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
    },
    [hotkeys]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);
}
