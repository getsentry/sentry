import {css} from '@emotion/react';

export const navigationCss = css`
  align-items: center;
  background: white;
  border: 1px solid var(--gray200);
  border-radius: var(--space150);
  display: flex;
  gap: var(--space50);
  padding: var(--space50);
`;

export const navigationRightEdgeCss = css`
  border-end-end-radius: 0;
  border-start-end-radius: 0;
  flex-direction: column;
`;

export const navigationBottomRightCornerCss = css`
  flex-direction: row;
`;

export const navigationButtonCss = css`
  border: 1px solid transparent;
  background: none;
  color: var(--gray400);
  padding: var(--space100) var(--space150);
  border-radius: var(--space100);
  gap: var(--space50);

  &[data-active-route='true'] {
    color: var(--purple300);
    background: var(--purple100);
    border-color: var(--purple100);
  }
`;
