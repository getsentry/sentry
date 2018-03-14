import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

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
        outline: 1px solid ${p.theme.purple};
      `
    : '';

/**
 * `hasControlState` - adds padding to right if this is false
 */
const FieldWrapper = styled(({highlighted, inline, hasControlState, ...props}) => (
  <Flex {...props} />
))`
  padding: 0.9em ${p => (p.hasControlState ? '0' : '1.3em')} 0.9em 1.3em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  transition: background 0.15s;

  ${inlineStyle} ${highlightedStyle} &:last-child {
    border-bottom: none;
  }
`;

export default FieldWrapper;
