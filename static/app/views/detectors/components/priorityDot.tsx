import styled from '@emotion/styled';

import {PriorityLevel} from 'sentry/types/group';

export const PriorityDot = styled('div')<{priority: PriorityLevel | 'resolved'}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.priority) {
      case PriorityLevel.HIGH:
        return p.theme.colors.red400;
      case PriorityLevel.MEDIUM:
        return p.theme.colors.yellow500;
      case 'resolved':
        return p.theme.colors.green400;
      default:
        return p.theme.colors.gray400;
    }
  }};
  flex-shrink: 0;
`;
