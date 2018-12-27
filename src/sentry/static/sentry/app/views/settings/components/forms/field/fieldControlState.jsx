import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

const width = '36px';
const FieldControlState = styled(({flexibleControlStateSize, ...props}) => (
  <Flex {...props} />
))`
  position: relative;
  ${p => !p.flexibleControlStateSize && `width: ${width}`};
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

export default FieldControlState;
