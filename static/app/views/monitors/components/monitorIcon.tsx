import styled from '@emotion/styled';

import {MonitorStatus} from '../types';

export default styled('div')<{size: number; status: MonitorStatus}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;

  ${p =>
    p.color
      ? `background: ${p.color};`
      : `background: ${
          p.status === MonitorStatus.ERROR || p.status === MonitorStatus.TIMEOUT
            ? p.theme.error
            : p.status === MonitorStatus.OK
            ? p.theme.success
            : p.status === MonitorStatus.MISSED_CHECKIN
            ? p.theme.warning
            : p.theme.disabled
        };`};
`;
