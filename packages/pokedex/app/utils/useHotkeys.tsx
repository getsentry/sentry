import {useCallback, useEffect, useMemo} from 'react';

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

/**
 * Pass in the hotkey combinations under match and the corresponding callback function to be called.
 * Separate key names with +. For example, 'command+alt+shift+x'
 * Alternate matchings as an array: ['command+alt+backspace', 'ctrl+alt+delete']
 *
 * Note: you can only use one non-modifier (keys other than shift, ctrl, alt, command) key at a time.
 */
export function useHotkeys(
  hotkeys: {callback: (e: KeyboardEvent) => void; match: string[] | string}[],
  deps: React.DependencyList
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHotkeys = useMemo(() => hotkeys, deps);

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      for (const set of memoizedHotkeys) {
        const keysets = Array.isArray(set.match) ? set.match : [set.match];
        for (const keyset of keysets) {
          const keys = keyset.split('+');

          if (keys.every(key => isKeyPressed(key, evt))) {
            set.callback(evt);
            return;
          }
        }
      }
    },
    [memoizedHotkeys]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);
}
