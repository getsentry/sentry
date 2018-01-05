import {Box} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

const FormFieldDescription = styled(({inline, ...props}) => <Box {...props} />)`
  ${p =>
    p.inline
      ? `
  width: 50%;
  padding-right: 10px;
  flex-shrink: 0;
  `
      : 'margin-bottom: 10px;'};
`;

export default FormFieldDescription;
