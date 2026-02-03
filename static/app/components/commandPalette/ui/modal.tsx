import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CommandPaletteContent} from 'sentry/components/commandPalette/ui/content';

function CommandPaletteModal({Body}: ModalRenderProps) {
  return (
    <Body>
      <CommandPaletteContent />
    </Body>
  );
}

export default CommandPaletteModal;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }
`;
