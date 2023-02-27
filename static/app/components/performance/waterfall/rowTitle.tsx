import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';

export const RowTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  height: ${ROW_HEIGHT}px;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  user-select: none;
`;

export const RowTitle = styled('div')`
  position: relative;
  height: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  display: flex;
  flex: 1;
  align-items: center;
`;

export const RowTitleContent = styled('span')<{errored: boolean}>`
  color: ${p => (p.errored ? p.theme.error : 'inherit')};
`;

export const SpanGroupRowTitleContent = styled('span')<{color: string}>`
  color: ${p => p.color};
`;
