import React from 'react';
import styled from 'react-emotion';

import HealthPanelChart from 'app/views/organizationHealth/styles/healthPanelChart';

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
  <HealthPanelChart {...props}>
    <LoadingMask />
  </HealthPanelChart>
))`
  flex: 1;
  height: 200px;
  position: relative;
  border-color: transparent;
`;

export default LoadingPanel;
