import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

import SettingsInputField from '../styled/input';
import SettingsTextAreaField from '../styled/textarea';

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

const FormFieldWrapper = styled(({highlighted, inline, ...props}) => <Flex {...props} />)`
  padding: 0.9em 0 0.9em 1.3em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  transition: background 0.15s;

  &:hover,
  &:focus {
    ${SettingsInputField}, ${SettingsTextAreaField} {
      border: 1px solid ${p => p.theme.borderDark};
    }
  }

  ${inlineStyle} ${highlightedStyle} &:last-child {
    border-bottom: none;
  }
`;

export default FormFieldWrapper;
