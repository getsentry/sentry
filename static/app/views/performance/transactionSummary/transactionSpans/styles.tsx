import styled from '@emotion/styled';

import space from 'sentry/styles/space';

export const Actions = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content 1fr min-content;
  align-items: center;
  margin-bottom: ${space(3)};
`;
