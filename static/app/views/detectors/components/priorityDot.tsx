import styled from '@emotion/styled';

import {PriorityLevel} from 'sentry/types/group';

export const PriorityDot = styled('div')<{priority: PriorityLevel | 'resolved'}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.priority) {
      case PriorityLevel.HIGH:
        return p.theme.tokens.graphics.danger.vibrant;
      case PriorityLevel.MEDIUM:
        return p.theme.tokens.graphics.warning.vibrant;
      case 'resolved':
        return p.theme.tokens.graphics.success.vibrant;
      default:
        return p.theme.colors.gray400;
    }
  }};
  flex-shrink: 0;
`;
