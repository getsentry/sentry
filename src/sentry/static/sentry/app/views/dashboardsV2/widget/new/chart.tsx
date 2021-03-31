import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';

function Chart() {
  return <StyledPanel>Chart</StyledPanel>;
}

export default Chart;

const StyledPanel = styled(Panel)`
  height: 100%;
  min-height: 96px;
`;
