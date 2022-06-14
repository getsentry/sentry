import styled from '@emotion/styled';

import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';
import {DurationDisplay} from 'sentry/components/performance/waterfall/types';
import {
  getDurationPillAlignment,
  getHatchPattern,
} from 'sentry/components/performance/waterfall/utils';

export const RowRectangle = styled('div')<{spanBarHatch: boolean}>`
  position: absolute;
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  left: 0;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  ${p => getHatchPattern(p, '#dedae3', '#f4f2f7')}
`;

export const DurationPill = styled('div')<{
  durationDisplay: DurationDisplay;
  showDetail: boolean;
  spanBarHatch: boolean;
}>`
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => (p.showDetail === true ? p.theme.gray200 : p.theme.gray300)};
  font-variant-numeric: tabular-nums;
  line-height: 1;

  ${getDurationPillAlignment}

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    font-size: 10px;
  }
`;
