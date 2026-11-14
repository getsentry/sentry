import styled from '@emotion/styled';

import type {SpanBarType} from './constants';
import {ROW_HEIGHT, ROW_PADDING} from './constants';
import {getHatchPattern} from './utils';

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
