import {useHotkeys} from 'sentry/utils/useHotkeys';

import {QuickAction} from './types';
import {quickActions} from './utils';

const SearchHotkeysListener = ({
  runQuickAction,
}: {
  runQuickAction: (action: QuickAction) => void;
}) => {
  useHotkeys(
    quickActions
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
