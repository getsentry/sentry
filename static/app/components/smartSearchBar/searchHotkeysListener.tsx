import {useHotkeys} from 'sentry/utils/useHotkeys';

import {commonActions, TokenActionType} from './types';

const SearchHotkeysListener = ({
  onTokenHotkeyPress,
}: {
  onTokenHotkeyPress: (actionType: TokenActionType) => void;
}) => {
  useHotkeys(
    commonActions.map(action => ({
      match: action.hotkeys.actual,
      callback: () => onTokenHotkeyPress(action.actionType),
    })),
    [onTokenHotkeyPress]
  );

  return null;
};

export default SearchHotkeysListener;
