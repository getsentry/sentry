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

const FieldWrapper = styled(({highlighted, inline, ...props}) => <Flex {...props} />)`
  padding: 0.9em 0 0.9em 1.3em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  transition: background 0.15s;

  ${inlineStyle} ${highlightedStyle} &:last-child {
    border-bottom: none;
  }
`;

export default FieldWrapper;
