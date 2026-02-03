import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Card = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(2)} ${space(2)};
`;
