import {useCallback} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function CommandPaletteModal({Body}: ModalRenderProps) {
  const navigate = useNavigate();
  const {query} = useCommandPaletteState();

  useDsnLookupActions(query);

  const handleSelect = useCallback(
    (action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>) => {
      const actionType = action.type;
      switch (actionType) {
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
    [navigate]
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
