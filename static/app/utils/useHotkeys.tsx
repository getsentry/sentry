import {DependencyList, useCallback, useEffect, useMemo, useRef} from 'react';

import {getKeyCode} from './getKeyCode';

const modifierKeys = [
  getKeyCode('command'),
  getKeyCode('shift'),
  getKeyCode('alt'),
  getKeyCode('ctrl'),
];

/**
 * Pass in the hotkey combinations under match and the corresponding callback function to be called.
 * Separate key names with +. For example, command+alt+shift+x
 * Alternate matchings with a comma: command+alt+backspace,ctrl+alt+delete
 */
export function useHotkeys(
  hotkeys: {callback: (e: KeyboardEvent) => void; match: string}[],
  deps?: DependencyList
): void {
  const keysPressedRef = useRef<number[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHotkeys = useMemo(() => hotkeys, deps);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const removeKey = keyCode => {
        keysPressedRef.current = keysPressedRef.current.filter(key => key !== keyCode);
      };

      const keysPressed = [...keysPressedRef.current, e.keyCode];

      keysPressedRef.current = keysPressed;

      if (e.metaKey && !modifierKeys.includes(e.keyCode)) {
        // If command is held, keyup does not work for other keys. https://web.archive.org/web/20160304022453/http://bitspushedaround.com/on-a-few-things-you-may-not-know-about-the-hellish-command-key-and-javascript-events/
        setTimeout(() => {
          removeKey(e.keyCode);
        }, 500);
      }

      for (const hotkey of memoizedHotkeys) {
        const matches = hotkey.match.split(',').map(o => o.trim().split(/(?<!\\)\+/g));

        for (const keys of matches) {
          if (
            keys.length === keysPressed.length &&
            keys.every(key => keysPressed.includes(getKeyCode(key)))
          ) {
            hotkey.callback(e);
            break;
          }
        }
      }

      if (e.type !== 'keydown') {
        removeKey(e.keyCode);
      }
    },
    [memoizedHotkeys]
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
