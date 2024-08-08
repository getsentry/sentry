import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

type FieldWrapperProps = Pick<
  FieldGroupProps,
  'hasControlState' | 'highlighted' | 'inline' | 'stacked'
>;

const inlineStyle = (p: FieldWrapperProps) =>
  p.inline
    ? css`
        align-items: center;
      `
    : css`
        flex-direction: column;
        align-items: stretch;
      `;

const getPadding = (p: FieldWrapperProps, theme: Theme) =>
  p.stacked && !p.inline
    ? css`
        padding: 0 ${theme.space(2)} ${theme.space(2)} 0;
      `
    : css`
        padding: ${theme.space(2)};
      `;

const FieldWrapper = styled('div')<FieldWrapperProps>`
  ${p => getPadding(p, p.theme)}
  ${inlineStyle}
  display: flex;
  transition: background 0.15s;

  ${p =>
    !p.stacked &&
    css`
      border-bottom: 1px solid ${p.theme.innerBorder};
    `}

  ${p =>
    p.highlighted &&
    css`
      position: relative;

      &:after {
        content: '';
        display: block;
        position: absolute;
        top: -1px;
        left: -1px;
        right: -1px;
        bottom: -1px;
        border: 1px solid ${p.theme.purple300};
        pointer-events: none;
      }
    `}


  /* Better padding with form inside of a modal */
  ${p =>
    !p.hasControlState &&
    css`
      [role='document'] & {
        padding-right: 0;
      }
    `}

  &:last-child {
    border-bottom: none;
    ${p => (p.stacked ? 'padding-bottom: 0' : '')};
  }
`;

export default FieldWrapper;
