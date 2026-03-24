import styled from '@emotion/styled';

export const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  justify-content: flex-start;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    min-width: fit-content;
    flex: 1;
  }
`;
