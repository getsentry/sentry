import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input/index';
import {TextArea} from 'sentry/components/core/textarea';
import {space} from 'sentry/styles/space';
import type {FormSize, StrictCSSObject, Theme} from 'sentry/utils/theme';

interface InputStyleProps {
  leadingWidth?: number;
  size?: FormSize;
  trailingWidth?: number;
}

const InputItemsWrap = styled('div')`
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
} satisfies Record<NonNullable<InputStyleProps['size']>, number>;

const chonkInputStyles = ({
  leadingWidth,
  trailingWidth,
  size = 'md',
  theme,
}: InputStyleProps & {theme: Theme}): StrictCSSObject => css`
  ${leadingWidth &&
  css`
    padding-left: calc(
      ${theme.form[size].paddingLeft}px + ${chonkItemsPadding[size]}px + ${leadingWidth}px
    );
  `}

  ${trailingWidth &&
  css`
    padding-right: calc(
      ${theme.form[size].paddingRight}px + ${chonkItemsPadding[size]}px +
        ${trailingWidth}px
    );
  `}
`;

export const ChonkStyledInput = styled(Input)<InputStyleProps>`
  ${chonkInputStyles}
`;

export const ChonkStyledTextArea = styled(TextArea)<InputStyleProps>`
  ${chonkInputStyles}
`;

export const ChonkStyledLeadingItemsWrap = styled(InputItemsWrap)<{
  size: NonNullable<InputStyleProps['size']>;
  disablePointerEvents?: boolean;
}>`
  left: ${p => p.theme.form[p.size].paddingLeft + 1}px;
  ${p => p.disablePointerEvents && `pointer-events: none;`}
`;

export const ChonkStyledTrailingItemsWrap = styled(InputItemsWrap)<{
  size: NonNullable<InputStyleProps['size']>;
  disablePointerEvents?: boolean;
}>`
  right: ${p => p.theme.form[p.size].paddingRight + 1}px;
  ${p => p.disablePointerEvents && `pointer-events: none;`}
`;
