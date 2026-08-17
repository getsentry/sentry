import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels/panel';

export type PerformanceWidgetContainerTypes = 'panel' | 'inline';

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  padding-top: ${p => p.theme.space.xl};
  margin-bottom: 0;
`;
const Div = styled('div')``;

export const PERFORMANCE_WIDGET_CONTAINERS: Record<
  PerformanceWidgetContainerTypes,
  typeof StyledPanel | typeof Div
> = {
  panel: StyledPanel,
  inline: Div,
};
