import {css} from '@emotion/core';
import styled from '@emotion/styled';

import space from 'app/styles/space';

/**
 * Using Parameters<typeof FieldWrapper> in the Field component somehow
 * causes an infinite recursive depth so exporting the props is best workaround
 */
export type Props = {
  stacked?: boolean;
  inline?: boolean;
  hasControlState?: boolean;
  highlighted?: boolean;
};

const inlineStyle = (p: Props) =>
  p.inline
    ? css`
        align-items: center;
      `
    : css`
        flex-direction: column;
        align-items: stretch;
      `;

const getPadding = (p: Props) =>
  p.stacked && !p.inline
    ? css`
        padding: 0 ${p.hasControlState ? 0 : space(2)} ${space(2)} 0;
      `
    : css`
        padding: ${space(2)} ${p.hasControlState ? 0 : space(2)} ${space(2)} ${space(2)};
      `;

/**
 * `hasControlState` - adds padding to right if this is false
 */
const FieldWrapper = styled('div')<Props>`
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
        top: -1px;
        left: -1px;
        right: -1px;
        bottom: -1px;
        border: 1px solid ${p.theme.purple400};
        pointer-events: none;
      }
    `}


  /* Better padding with form inside of a modal */
  ${p =>
    !p.hasControlState &&
    css`
      .modal-content & {
        padding-right: 0;
      }
    `}

  &:last-child {
    border-bottom: none;
    ${p => (p.stacked ? 'padding-bottom: 0' : '')};
  }
`;

export default FieldWrapper;
