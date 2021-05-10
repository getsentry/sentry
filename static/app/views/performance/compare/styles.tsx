import styled from '@emotion/styled';

import {ROW_HEIGHT, ROW_PADDING} from 'app/components/performance/waterfall/constants';

export const SpanBarRectangle = styled('div')`
  position: relative;
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  top: ${ROW_PADDING}px;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  border-right: 1px solid rgba(0, 0, 0, 0);
`;
