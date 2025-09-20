import styled from '@emotion/styled';

import type {SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';
import {getHatchPattern} from 'sentry/components/performance/waterfall/utils';

export const RowRectangle = styled('div')<{
  isHidden?: boolean;
  spanBarType?: SpanBarType;
}>`
  position: absolute;
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  left: 0;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  ${p => !p.isHidden && getHatchPattern(p.spanBarType, p.theme)}
`;
