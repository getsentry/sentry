import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';

export const MeasurementMarker = styled('div')<{failedThreshold: boolean}>`
  position: absolute;
  top: 0;
  height: ${ROW_HEIGHT}px;
  user-select: none;
  width: 1px;
  background: repeating-linear-gradient(
      to bottom,
      transparent 0 4px,
      ${p => (p.failedThreshold ? p.theme.red300 : p.theme.textColor)} 4px 8px
    )
    80%/2px 100% no-repeat;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};
  color: ${p => p.theme.textColor};
`;
