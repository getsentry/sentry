import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CommandPaletteContent} from 'sentry/components/commandPalette/ui/content';
import type {Theme} from 'sentry/utils/theme';

function CommandPaletteModal({Body}: ModalRenderProps) {
  return (
    <Body>
      <CommandPaletteContent />
    </Body>
  );
}

export default CommandPaletteModal;

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
