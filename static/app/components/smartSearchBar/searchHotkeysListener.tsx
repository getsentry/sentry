import {useHotkeys} from 'sentry/utils/useHotkeys';

import {Shortcut} from './types';

function SearchHotkeysListener({
  visibleShortcuts,
  runShortcut,
}: {
  runShortcut: (shortcut: Shortcut) => void;
  visibleShortcuts: Shortcut[];
}) {
  useHotkeys(
    visibleShortcuts
      .filter(shortcut => typeof shortcut.hotkeys !== 'undefined')
      .map(shortcut => ({
        match: shortcut.hotkeys?.actual ?? [],
        includeInputs: true,
        callback: () => runShortcut(shortcut),
      })),
    [visibleShortcuts]
  );

  return null;
}

export default SearchHotkeysListener;
