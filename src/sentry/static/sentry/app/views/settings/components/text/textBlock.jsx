import React from 'react';
import styled from 'react-emotion';

const TextBlock = styled(({noMargin, ...props}) => <div {...props} />)`
  line-height: 1.5;
  ${p => (p.noMargin ? '' : 'margin-bottom: 30px')};
`;

export default TextBlock;
