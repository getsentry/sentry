import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

import SettingsInputField from '../styled/input';
import SettingsTextAreaField from '../styled/textarea';

const FormFieldWrapper = styled(({highlighted, ...props}) => <Flex {...props} />)`
  padding: 15px 0 15px 20px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  align-items: center;
  transition: background 0.15s;

  &:hover {
    ${SettingsInputField}, ${SettingsTextAreaField} {
      ${p => css`
        background: ${p.error ? '#fff' : p.theme.offWhite};
      `};
    }
  }

  ${p =>
    p.highlighted
      ? css`
          outline: 1px solid ${p.theme.purple};
        `
      : ''} &:last-child {
    border-bottom: none;
  }
`;

export default FormFieldWrapper;
