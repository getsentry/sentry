import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';
import space from 'app/styles/space';

const inlineStyle = p =>
  p.inline
    ? css`
        align-items: center;
      `
    : css`
        flex-direction: column;
        align-items: stretch;
      `;

const highlightedStyle = p =>
  p.highlighted
    ? css`
        position: relative;

        &:after {
          content: '';
          display: block;
          position: absolute;
          top: -1px;
          left: -1px;
          right: -1px;
          bottom: -1px;
          border: 1px solid ${p.theme.purple};
          pointer-events: none;
        }
      `
    : '';

const borderStyle = p =>
  p.stacked
    ? ''
    : css`
        border-bottom: 1px solid ${p.theme.borderLight};
      `;

const getPadding = p =>
  p.stacked && !p.inline
    ? css`
        padding: 0 ${p.hasControlState ? 0 : space(2)} ${space(1)} 0;
      `
    : css`
        padding: ${space(2)} ${p.hasControlState ? 0 : space(2)} ${space(2)} ${space(2)};
      `;

/**
 * `hasControlState` - adds padding to right if this is false
 */
const FieldWrapper = styled(p => <Flex {...p} />, {
  shouldForwardProp: prop =>
    !['highlighted', 'inline', 'stacked', 'hasControlState', 'p'].includes(prop),
})`
  ${getPadding};
  transition: background 0.15s;

  ${borderStyle};
  ${inlineStyle};
  ${highlightedStyle};

  /* Better padding with form inside of a modal */
  ${p =>
    !p.hasControlState
      ? `.modal-content & {
      padding-right: 0;
    }`
      : ''};

  &:last-child {
    border-bottom: none;
    ${p => (p.stacked ? 'padding-bottom: 0' : '')};
  }
`;

export default FieldWrapper;
