import {Fragment, useCallback, useLayoutEffect, useRef} from 'react';

import {closeModal} from 'sentry/actionCreators/modal';
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

export function CommandPaletteContent() {
  const {selectedAction, query} = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  useDsnLookupActions(query);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (action: CommandPaletteActionWithKey) => {
      const actionType = action.type;
      switch (actionType) {
        case 'group':
          dispatch({type: 'select_action', action});
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
      closeModal();
    },
    [navigate, dispatch]
  );

  useLayoutEffect(() => {
    if (selectedAction) {
      dispatch({type: 'set_query', query: ''});
      inputRef.current?.focus();
    }
  }, [selectedAction, dispatch]);

  return (
    <Fragment>
      <CommandPaletteList
        query={query}
        onAction={handleSelect}
        inputRef={inputRef}
        setQuery={q => dispatch({type: 'set_query', query: q})}
        clearSelection={() => dispatch({type: 'clear_selection'})}
        selectedAction={selectedAction}
      />
    </Fragment>
  );
}
