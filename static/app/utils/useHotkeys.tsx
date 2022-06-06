import {useCallback, useEffect, useMemo, useRef} from 'react';

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
  hotkeys: {callback: (e: KeyboardEvent) => void; match: string[] | string}[],
  deps: React.DependencyList
): void {
  const keysPressedRef = useRef<Set<number>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHotkeys = useMemo(() => hotkeys, deps);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const removeKey = keyCode => {
        keysPressedRef.current.delete(keyCode);
      };

      keysPressedRef.current.add(e.keyCode);

      if (e.metaKey && !modifierKeys.includes(e.keyCode)) {
        /*
          If command/metaKey is held, keyup does not get called for non-modifier keys. See:
          https://web.archive.org/web/20160304022453/http://bitspushedaround.com/on-a-few-things-you-may-not-know-about-the-hellish-command-key-and-javascript-events/

          So, if the metaKey is held, we just have it remove the key after a set timeout, this allows you to hold the command key down
          and press the other key again after the timeout removes the key.
        */
        setTimeout(() => {
          removeKey(e.keyCode);
        }, 500);
      }

      for (const hotkey of memoizedHotkeys) {
        const matches = (Array.isArray(hotkey.match) ? hotkey.match : [hotkey.match]).map(
          o => o.trim().split('+')
        );

        for (const keys of matches) {
          if (
            keys.length === keysPressedRef.current.size &&
            keys.every(key => keysPressedRef.current.has(getKeyCode(key)))
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
