import styled from '@emotion/styled';

export const Layout = styled('div')`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: ${p => p.theme.space.xl};
`;

export const Full = styled('div')`
  grid-column: span 12;
`;
