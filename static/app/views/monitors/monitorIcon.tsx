import styled from '@emotion/styled';

import {Status} from './types';

export default styled('div')<{size: number; status: Status}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;

  ${p =>
    p.color
      ? `background: ${p.color};`
      : `background: ${
          p.status === 'error'
            ? p.theme.error
            : p.status === 'ok'
            ? p.theme.success
            : p.status === 'missed_checkin'
            ? p.theme.warning
            : p.theme.disabled
        };`};
`;
