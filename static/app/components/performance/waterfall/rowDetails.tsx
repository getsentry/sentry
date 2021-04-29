import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

export const ErrorMessageTitle = styled('div')`
  display: flex;
  justify-content: space-between;
`;

export const ErrorMessageContent = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: 16px 72px auto;
  grid-gap: ${space(0.75)};
  margin-top: ${space(0.75)};
`;

export const ErrorDot = styled('div')<{level: keyof Theme['level']}>`
  background-color: ${p => p.theme.level[p.level]};
  content: '';
  width: ${space(1)};
  min-width: ${space(1)};
  height: ${space(1)};
  margin-right: ${space(1)};
  border-radius: 100%;
  flex: 1;
`;

export const ErrorLevel = styled('span')`
  width: 80px;
`;

export const ErrorTitle = styled('span')`
  ${overflowEllipsis};
`;
