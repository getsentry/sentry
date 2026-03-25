import {useCallback} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {
  getActionPath,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function CommandPaletteModal({Body}: ModalRenderProps) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const state = useCommandPaletteState();
  const {query} = state;

  useDsnLookupActions(query);

  const handleSelect = useCallback(
    (action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>) => {
      const actionType = action.type;
      switch (actionType) {
        case 'navigate':
        case 'callback': {
          const path = getActionPath(state);
          const label =
            path.length > 0 ? `${path} -> ${action.display.label}` : action.display.label;
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
      closeModal();
    },
    [navigate, organization, state, query]
  );

  return (
    <Body>
      <CommandPalette onAction={handleSelect} />
    </Body>
  );
}

export const modalCss = (theme: Theme) => {
  return css`
    [role='document'] {
      padding: 0;

      background-color: ${theme.tokens.background.primary};
      border-top-left-radius: calc(${theme.radius.lg} + 1px);
      border-top-right-radius: calc(${theme.radius.lg} + 1px);
    }
  `;
};
