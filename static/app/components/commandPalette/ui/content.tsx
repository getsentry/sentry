import {Fragment, useCallback} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {CommandPaletteList} from 'sentry/components/commandPalette/ui/list';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

interface CommandPaletteContentProps {
  onClose: () => void;
}

export function CommandPaletteContent({onClose}: CommandPaletteContentProps) {
  const navigate = useNavigate();

  const {query} = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();

  useDsnLookupActions(query);

  const handleSelect = useCallback(
    (action: CommandPaletteActionWithKey) => {
      dispatch({type: 'trigger action'});

      const actionType = action.type;
      switch (actionType) {
        case 'group':
          dispatch({type: 'set selected action', action});
          return;
        case 'navigate':
          navigate(normalizeUrl(action.to));
          break;
        case 'callback':
          action.onAction();
          break;
        default:
          unreachable(actionType);
          break;
      }
      onClose();
    },
    [navigate, dispatch, onClose]
  );

  return (
    <Fragment>
      <CommandPaletteList onAction={handleSelect} />
    </Fragment>
  );
}
