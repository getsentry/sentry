import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Card = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  background-color: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(2)};
`;
