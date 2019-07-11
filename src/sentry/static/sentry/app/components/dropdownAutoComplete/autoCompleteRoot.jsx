import React from 'react';
import styled from 'react-emotion';

const AutoCompleteRoot = styled(({isOpen: _isOpen, ...props}) => <div {...props} />)`
  position: relative;
  display: inline-block;
`;

export default AutoCompleteRoot;
