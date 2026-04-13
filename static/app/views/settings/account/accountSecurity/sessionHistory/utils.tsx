import type {Theme} from '@emotion/react';

export const tableLayout = (p: {theme: Theme}) => `
  display: grid;
  grid-template-columns: auto 140px 140px;
  gap ${p.theme.space.md};
  align-items: center;
`;
