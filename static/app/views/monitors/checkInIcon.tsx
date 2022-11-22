import styled from '@emotion/styled';

import {CheckInStatus} from './types';

type Props = {
  size: number | string;
  status: CheckInStatus;
  color?: string;
};

export default styled('div')<Props>`
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
            : p.status === 'missed'
            ? p.theme.warning
            : p.theme.disabled
        };`};
`;
