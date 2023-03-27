import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import {space} from 'sentry/styles/space';

export type PerformanceWidgetContainerTypes = 'panel' | 'inline';

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
  margin-bottom: 0;
`;
const Div = styled('div')``;

const getPerformanceWidgetContainer = ({
  containerType,
}: {
  containerType: PerformanceWidgetContainerTypes;
}) => {
  if (containerType === 'panel') {
    return StyledPanel;
  }
  if (containerType === 'inline') {
    return Div;
  }
  return Div;
};

export default getPerformanceWidgetContainer;
