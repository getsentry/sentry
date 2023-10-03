import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Table = styled('table')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border-collapse: separate;
  border: 1px ${p => 'solid ' + p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
  margin-bottom: ${space(2)};
  width: 100%;
`;

export const HeaderCell = styled('th')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(2)};
`;

export const TableData = styled('td')`
  padding: ${space(2)};
`;
