import styled from '@emotion/styled';

import {
  ROW_HEIGHT,
  ROW_PADDING,
  SpanBarType,
} from 'sentry/components/performance/waterfall/constants';
import {DurationDisplay} from 'sentry/components/performance/waterfall/types';
import {
  getDurationPillAlignment,
  getDurationPillColours,
  getHatchPattern,
} from 'sentry/components/performance/waterfall/utils';
import space from 'sentry/styles/space';

export const RowRectangle = styled('div')<{
  spanBarType?: SpanBarType;
}>`
  position: absolute;
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  left: 0;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  ${p => getHatchPattern(p.spanBarType, p.theme)}
`;

export const DurationPill = styled('div')<{
  durationDisplay: DurationDisplay;
  showDetail: boolean;
  spanBarType?: SpanBarType;
}>`
  position: absolute;
  border-radius: ${p => p.theme.borderRadius};
  padding: 0 ${space(0.5)};
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeExtraSmall};

  font-variant-numeric: tabular-nums;
  line-height: 1;

  ${getDurationPillAlignment}
  ${getDurationPillColours}

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    font-size: 10px;
  }
`;
