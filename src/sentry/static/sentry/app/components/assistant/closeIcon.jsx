import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';

const CloseIcon = styled(props => <InlineSvg src="icon-close-lg" {...props} />)`
  stroke-width: 3px;
  width: 0.75em;
  height: 0.75em;
  margin: 0 0.875em 0 0.66em;
  cursor: pointer;
`;

export default CloseIcon;
