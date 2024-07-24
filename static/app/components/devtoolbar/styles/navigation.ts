import {css} from '@emotion/react';

export const navigationCss = css`
  align-items: center;
  display: flex;
  gap: var(--space50);
  padding: var(--space50);

  background: rgb(58, 46, 93);
  background: linear-gradient(41deg, rgba(58, 46, 93, 1) 61%, rgba(136, 81, 145, 1) 100%);
  border-radius: var(--space150);
  border: 1px solid var(--gray200);
  color: white;

  transition: opacity 2s ease-out 3s;

  &[data-has-active='false'] {
    opacity: 0.15;
  }

  &:hover {
    transition: opacity 0.1s ease-in 0s;
    opacity: 1;
  }
`;

export const navigationRightEdgeCss = css`
  border-end-end-radius: 0;
  border-start-end-radius: 0;
  flex-direction: column;
`;

export const navigationBottomRightCornerCss = css`
  flex-direction: row;
`;
