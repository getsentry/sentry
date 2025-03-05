import {css, type DO_NOT_USE_ChonkTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input/index';
import Textarea from 'sentry/components/forms/controls/textarea';
import {space} from 'sentry/styles/space';
import type {FormSize, StrictCSSObject} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

export interface InputStyleProps {
  leadingWidth?: number;
  size?: FormSize;
  trailingWidth?: number;
}

export const InputItemsWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};

  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const chonkItemsPadding = {
  md: 8,
  sm: 6,
  xs: 4,
} satisfies Record<FormSize, number>;

const chonkInputStyles = ({
  leadingWidth,
  trailingWidth,
  size = 'md',
  theme,
}: InputStyleProps & {theme: DO_NOT_USE_ChonkTheme}): StrictCSSObject => css`
  ${leadingWidth &&
  `
    padding-left: calc(
      ${theme.formPadding[size].paddingLeft}px
      + ${chonkItemsPadding[size]}px
      + ${leadingWidth}px
    );
  `}

  ${trailingWidth &&
  `
    padding-right: calc(
      ${theme.formPadding[size].paddingRight}px
      + ${chonkItemsPadding[size]}px
      + ${trailingWidth}px
    );
  `}
`;

export const ChonkStyledInput = chonkStyled(Input)<InputStyleProps>`
  ${chonkInputStyles}
`;

export const ChonkStyledTextArea = chonkStyled(Textarea)<InputStyleProps>`
  ${chonkInputStyles}
`;

export const ChonkStyledLeadingItemsWrap = chonkStyled(InputItemsWrap)<{
  size: FormSize;
  disablePointerEvents?: boolean;
}>`
    left: ${p => p.theme.formPadding[p.size].paddingLeft + 1}px;
    ${p => p.disablePointerEvents && `pointer-events: none;`}
  `;

export const ChonkStyledTrailingItemsWrap = chonkStyled(InputItemsWrap)<{
  size: FormSize;
  disablePointerEvents?: boolean;
}>`
    right: ${p => p.theme.formPadding[p.size].paddingRight + 1}px;
    ${p => p.disablePointerEvents && `pointer-events: none;`}
  `;
