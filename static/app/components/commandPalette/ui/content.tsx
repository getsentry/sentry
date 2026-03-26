import {Fragment, useCallback} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {CommandPaletteList} from 'sentry/components/commandPalette/ui/list';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';
import {trackAnalytics} from 'sentry/utils/analytics';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

interface CommandPaletteContentProps {
  onClose: () => void;
}

export function CommandPaletteContent({onClose}: CommandPaletteContentProps) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const {query, selectedAction} = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();

  useDsnLookupActions(query);

  const handleSelect = useCallback(
    (action: CommandPaletteActionWithKey) => {
      dispatch({type: 'trigger action'});

      const actionType = action.type;
      switch (actionType) {
        case 'group':
          trackAnalytics('command_palette.action_selected', {
            organization,
            action: action.display.label,
            query,
          });
          dispatch({type: 'set selected action', action});
          return;
        case 'navigate':
        case 'callback': {
          const label = selectedAction
            ? `${selectedAction.display.label} -> ${action.display.label}`
            : action.display.label;
          trackAnalytics('command_palette.action_selected', {
            organization,
            action: label,
            query,
          });
          if (actionType === 'navigate') {
            navigate(normalizeUrl(action.to));
          } else {
            action.onAction();
          }
          break;
        }
        default:
          unreachable(actionType);
          break;
      }
      onClose();
    },
    [navigate, dispatch, organization, selectedAction, query, onClose]
  );

  return (
    <Fragment>
      <CommandPaletteList onAction={handleSelect} />
    </Fragment>
  );
}
