import {css} from '@emotion/react';

export const fixedContainerBaseCss = css`
  display: flex;
  gap: var(--space150);
  inset: 0;
  pointer-events: none;
  position: fixed;
  z-index: var(--z-index);

  & > * {
    pointer-events: all;
  }
`;

export const fixedContainerRightEdgeCss = css`
  flex-direction: row-reverse;
  justify-content: flex-start;
  place-items: center;
`;

export const fixedContainerBottomRightCornderCss = css`
  flex-direction: column-reverse;
  justify-content: flex-start;
  padding: var(--space150);
  place-items: flex-end;
`;
