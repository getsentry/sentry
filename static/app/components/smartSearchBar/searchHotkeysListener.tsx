import {useHotkeys} from 'sentry/utils/useHotkeys';

import {commonActions, QuickAction} from './types';

const SearchHotkeysListener = ({
  runQuickAction,
}: {
  runQuickAction: (action: QuickAction) => void;
}) => {
  useHotkeys(
    commonActions
      .filter(action => typeof action.hotkeys !== 'undefined')
      .map(action => ({
        match: action.hotkeys?.actual ?? [],
        callback: e => {
          e.preventDefault();
          runQuickAction(action);
        },
      })),
    [runQuickAction]
  );

  return null;
};

export default SearchHotkeysListener;
