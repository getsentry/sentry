import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

export const TimelineRow = styled(SimpleTable.Row)`
  &.beforeHoverTime + .afterHoverTime:before {
    border-top: 1px solid ${p => p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeHoverTime.isLastDataRow:before {
    border-bottom: 1px solid ${p => p.theme.tokens.border.accent.moderate};
    bottom: 0;
    content: '';
    left: 0;
    position: absolute;
    width: 100%;
  }

  &.beforeCurrentTime + .afterCurrentTime:after {
    border-top: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeCurrentTime.isLastDataRow:after {
    border-bottom: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
    bottom: 0;
    content: '';
    left: 0;
    position: absolute;
    width: 100%;
  }
`;
