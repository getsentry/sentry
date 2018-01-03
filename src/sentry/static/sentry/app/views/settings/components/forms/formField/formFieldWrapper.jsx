import React from 'react';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

const FormFieldWrapper = styled(({highlighted, ...props}) => <Flex {...props} />)`
  padding: 15px 20px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  align-items: center;
  transition: background 0.15s;

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
