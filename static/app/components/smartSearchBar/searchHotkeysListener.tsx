import {useHotkeys} from 'sentry/utils/useHotkeys';

import {commonActions, TokenActionType} from './types';

const SearchHotkeysListener = ({
  runTokenActionOnActiveToken,
}: {
  runTokenActionOnActiveToken: (actionType: TokenActionType) => void;
}) => {
  useHotkeys(
    commonActions.map(action => ({
      match: action.hotkeys.actual,
      callback: e => {
        e.preventDefault();
        runTokenActionOnActiveToken(action.actionType);
      },
    })),
    [runTokenActionOnActiveToken]
  );

  return null;
};

export default SearchHotkeysListener;
