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
        outline: 1px solid ${p.theme.purple};
      `
    : '';

const getPadding = props => {
  if (typeof props.p !== 'undefined') {
    return `padding: ${props.p};`;
  }
  return `padding: ${space(2)} ${props.hasControlState ? 0 : space(2)} ${space(
    2
  )} ${space(2)}`;
};

/**
 * `hasControlState` - adds padding to right if this is false
 */
const FieldWrapper = styled(({highlighted, inline, hasControlState, p, ...props}) => (
  <Flex {...props} />
))`
  ${getPadding};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  transition: background 0.15s;

  ${inlineStyle} ${highlightedStyle} &:last-child {
    border-bottom: none;
  }
`;

export default FieldWrapper;
