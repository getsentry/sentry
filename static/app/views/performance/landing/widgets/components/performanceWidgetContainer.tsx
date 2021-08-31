import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

export type PerformanceWidgetContainerTypes = 'panel' | 'inline';

const StyledPanel = styled(Panel)`
  padding: ${space(2)};
  margin-bottom: 0;
`;

const getPerformanceWidgetContainer = ({
  containerType,
}: {
  containerType: PerformanceWidgetContainerTypes;
}) => {
  if (containerType === 'panel') {
    return StyledPanel;
  } else if (containerType === 'inline') {
    return Fragment;
  } else {
    return Fragment;
  }
};

export default getPerformanceWidgetContainer;
