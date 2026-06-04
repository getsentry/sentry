import {css} from '@emotion/react';
import styled from '@emotion/styled';

/**
 * Common performance layouts
 */

export const PerformanceLayoutBodyRow = styled('div')<{
  minSize: number;
  columns?: number;
}>`
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: ${p => p.theme.space.xl};
  grid-row-gap: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    ${p =>
      p.columns
        ? css`
            grid-template-columns: repeat(${p.columns}, 1fr);
          `
        : css`
            grid-template-columns: repeat(auto-fit, minmax(${p.minSize}px, 1fr));
          `}
  }
`;
