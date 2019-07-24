import React from 'react';
import styled from 'react-emotion';

const LoadingMask = styled('div')`
  background-color: ${p => p.theme.offWhite};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

const LoadingPanel = styled(props => (
  <div {...props}>
    <LoadingMask />
  </div>
))`
  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: 200px;
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;

export default LoadingPanel;
export {LoadingMask};
