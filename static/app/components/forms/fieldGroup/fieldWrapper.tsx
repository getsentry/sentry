import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import type {FieldGroupProps} from './types';

interface FieldWrapperProps
  extends Pick<
    FieldGroupProps,
    'hasControlState' | 'highlighted' | 'inline' | 'stacked'
  > {}

const inlineStyle = (p: FieldWrapperProps) =>
  p.inline
    ? css`
        align-items: center;
      `
    : css`
        flex-direction: column;
        align-items: stretch;
      `;

const getPadding = (p: FieldWrapperProps) =>
  p.stacked && !p.inline
    ? css`
        padding: 0 ${space(2)} ${space(2)} 0;
      `
    : css`
        padding: ${space(2)};
      `;

export const FieldWrapper = styled('div')<FieldWrapperProps>`
  ${getPadding}
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
        inset: -1px;
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
