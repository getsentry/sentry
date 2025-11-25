import styled from '@emotion/styled';

import {PriorityLevel} from 'sentry/types/group';

export const PriorityDot = styled('div')<{priority: PriorityLevel | 'resolved'}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.priority) {
      case PriorityLevel.HIGH:
        return p.theme.red300;
      case PriorityLevel.MEDIUM:
        return p.theme.yellow400;
      case 'resolved':
        return p.theme.green300;
      default:
        return p.theme.gray300;
    }
  }};
  flex-shrink: 0;
`;
