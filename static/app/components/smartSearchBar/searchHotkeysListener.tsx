import {useHotkeys} from 'sentry/utils/useHotkeys';

import {Shortcut} from './types';

const SearchHotkeysListener = ({
  visibleShortcuts,
  runShortcut,
}: {
  runShortcut: (shortcut: Shortcut) => void;
  visibleShortcuts: Shortcut[];
}) => {
  useHotkeys(
    visibleShortcuts
      .filter(shortcut => typeof shortcut.hotkeys !== 'undefined')
      .map(shortcut => ({
        match: shortcut.hotkeys?.actual ?? [],
        callback: e => {
          e.preventDefault();
          runShortcut(shortcut);
        },
      })),
    [visibleShortcuts]
  );

  return null;
};

export default SearchHotkeysListener;
