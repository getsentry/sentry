import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const RowLine = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  flex-wrap: wrap;
  flex: 1;
`;

export const OptionalRowLine = styled(RowLine)`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  padding-top: ${space(1)};
`;
