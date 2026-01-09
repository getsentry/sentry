import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  justify-content: flex-start;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1.5)};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    min-width: fit-content;
    flex: 1;
  }
`;
