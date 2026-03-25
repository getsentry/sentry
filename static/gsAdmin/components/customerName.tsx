import styled from '@emotion/styled';

export const CustomerName = styled('div')`
  display: grid;
  grid-template: max-content max-content / max-content 1fr;
  gap: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  > :first-child {
    grid-row: 1 / 3;
  }
`;
