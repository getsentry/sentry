import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import type {Theme} from 'sentry/utils/theme';

export default function CommandPaletteModal({Body, closeModal}: ModalRenderProps) {
  return (
    <Body>
      <CommandPalette closeModal={closeModal} />
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
