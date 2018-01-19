import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

import SettingsInputField from '../styled/input';
import SettingsTextAreaField from '../styled/textarea';

const FormFieldWrapper = styled(({highlighted, inline, ...props}) => <Flex {...props} />)`
  padding: 0.9em 0 0.9em 1.3em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  transition: background 0.15s;

  ${SettingsInputField}, ${SettingsTextAreaField} {
    background: ${p => (p.error ? '#fff' : p.theme.offWhite)};
    border: 1px solid ${p => p.theme.borderLight};

    &:hover, &:focus { border: 1px solid ${p => p.theme.borderDark}}
  }

  ${p => {
    if (p.inline) {
      return 'align-items: center;';
    } else {
      return `
        flex-direction: column;
        align-items: stretch;
      `;
    }
  }} ${p => {
  if (p.highlighted) {
    return css`
      outline: 1px solid ${p.theme.purple};
    `;
  } else {
    return '';
  }
}} &:last-child {
    border-bottom: none;
  }
`;

export default FormFieldWrapper;
