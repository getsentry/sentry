import styled from '@emotion/styled';

import {
  SPAN_ROW_HEIGHT,
  SPAN_ROW_PADDING,
} from 'app/components/events/interfaces/spans/styles';

export const SpanBarRectangle = styled('div')`
  position: relative;
  height: ${SPAN_ROW_HEIGHT - 2 * SPAN_ROW_PADDING}px;
  top: ${SPAN_ROW_PADDING}px;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  border-right: 1px solid rgba(0, 0, 0, 0);
`;
