import {Children} from 'react';
import styled from '@emotion/styled';

const FiltersGrid = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-template-columns:
    repeat(${p => Children.toArray(p.children).length - 1}, max-content)
    1fr;
  margin-bottom: ${p => p.theme.space.md};
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin-top: ${p => p.theme.space.md};
  }
`;

export default FiltersGrid;
