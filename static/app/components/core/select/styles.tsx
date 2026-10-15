import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {FormSize} from 'sentry/utils/theme';

export const CheckWrap = styled('div')<{
  isMultiple: boolean;
  isSelected: boolean;
  size: FormSize;
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1.4em;

  ${p =>
    p.isMultiple
      ? css`
          padding: 1px;
          border: solid 1px ${p.theme.tokens.border.primary};
          background: ${p.theme.tokens.background.primary};
          border-radius: 2px;
          height: 1em;
          margin-top: 2px;
          ${
            p.isSelected &&
            css`
              background: ${p.theme.tokens.background.accent.vibrant};
              border-color: ${p.theme.tokens.border.accent};
            `
          }
        `
      : css`
          ${
            p.isSelected &&
            css`
              color: ${p.theme.tokens.content.accent};
            `
          }
        `}
`;
