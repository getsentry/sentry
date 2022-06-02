import React from 'react';

import HotkeysListener from 'sentry/utils/hotkeyslistener';

import {commonActions, TokenActionType} from './types';

const SearchHotkeysListener = ({
  onTokenHotkeyPress,
}: {
  onTokenHotkeyPress: (actionType: TokenActionType) => void;
}) => {
  const hotkeys = React.useMemo(() => {
    return commonActions.map(action => ({
      match: action.hotkeys.actual,
      callback: () => onTokenHotkeyPress(action.actionType),
    }));
  }, [onTokenHotkeyPress]);

  return <HotkeysListener hotkeys={hotkeys} />;
};

export default SearchHotkeysListener;
