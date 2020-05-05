import React from 'react';
import styled from '@emotion/styled';

import LoadingMask from 'app/components/loadingMask';

const LoadingPanel = styled(props => (
  <div {...props}>
    <LoadingMask />
  </div>
))`
  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: ${p => p.height};
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;

LoadingPanel.defaultProps = {
  height: '200px',
};

export default LoadingPanel;
