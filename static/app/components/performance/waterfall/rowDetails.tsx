import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

export const ErrorMessageTitle = styled('div')`
  display: flex;
  justify-content: space-between;
`;

export const ErrorMessageContent = styled('div')<{excludeLevel?: boolean}>`
  display: grid;
  align-items: center;
  grid-template-columns: ${p => (p.excludeLevel ? '16px auto' : '16px 72px auto')};
  gap: ${p => p.theme.space(0.75)};
  margin-top: ${p => p.theme.space(0.75)};
`;

export const ErrorDot = styled('div')<{level: keyof Theme['level']}>`
  background-color: ${p => p.theme.level[p.level]};
  content: '';
  width: ${p => p.theme.space(1)};
  min-width: ${p => p.theme.space(1)};
  height: ${p => p.theme.space(1)};
  margin-right: ${p => p.theme.space(1)};
  border-radius: 100%;
  flex: 1;
`;

export const ErrorLevel = styled('span')`
  width: 80px;
`;

export const ErrorTitle = styled('span')`
  ${p => p.theme.overflowEllipsis};
`;
