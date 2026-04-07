import {useCallback} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function CommandPaletteModal({Body}: ModalRenderProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback(
    (action: CommandPaletteActionWithKey) => {
      if ('to' in action) {
        navigate(normalizeUrl(action.to));
      } else if ('onAction' in action) {
        action.onAction();
      } else {
        // @TODO: handle async actions
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
