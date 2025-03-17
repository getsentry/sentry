import {useMemo} from 'react';

import {useHotkeys} from 'sentry/utils/useHotkeys';

import type {Shortcut} from './types';

function SearchHotkeysListener({
  visibleShortcuts,
  runShortcut,
}: {
  runShortcut: (shortcut: Shortcut) => void;
  visibleShortcuts: Shortcut[];
}) {
  const hotkeys = useMemo(() => {
    return visibleShortcuts
      .filter(shortcut => typeof shortcut.hotkeys !== 'undefined')
      .map(shortcut => ({
        match: shortcut.hotkeys?.actual ?? [],
        includeInputs: true,
        callback: () => runShortcut(shortcut),
      }));
  }, [visibleShortcuts, runShortcut]);

  useHotkeys(hotkeys);
  return null;
}

export default SearchHotkeysListener;
