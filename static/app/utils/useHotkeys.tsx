import {useCallback, useEffect, useRef} from 'react';

import {getKeyCode} from './getKeyCode';

/**
 * Pass in the hotkey combinations under match and the corresponding callback function to be called.
 * Separate key names with +. For example, command+alt+shift+x
 * Alternate matchings with a comma: command+alt+backspace,ctrl+alt+delete
 */
export function useHotkeys(hotkeys: {callback: () => void; match: string}[]): void {
  const keysPressedRef = useRef<number[]>([]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const removeKey = keyCode => {
        keysPressedRef.current = keysPressedRef.current.filter(key => key !== keyCode);
      };

      const keysPressed = [...keysPressedRef.current, e.keyCode];

      keysPressedRef.current = keysPressed;

      if (e.keyCode !== getKeyCode('command') && e.metaKey) {
        // If command is held, keyup does not work for other keys. https://web.archive.org/web/20160304022453/http://bitspushedaround.com/on-a-few-things-you-may-not-know-about-the-hellish-command-key-and-javascript-events/
        setTimeout(() => {
          removeKey(e.keyCode);
        }, 500);
      }

      for (const hotkey of hotkeys) {
        const matches = hotkey.match.split(',').map(o => o.trim().split(/(?<!\\)\+/g));

        for (const keys of matches) {
          if (
            keys.length === keysPressed.length &&
            keys.every(key => keysPressed.includes(getKeyCode(key)))
          ) {
            hotkey.callback();
            e.preventDefault();
            break;
          }
        }
      }

      if (e.type !== 'keydown') {
        removeKey(e.keyCode);
      }
    },
    [hotkeys]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyDown);
    };
  }, [onKeyDown]);
}
