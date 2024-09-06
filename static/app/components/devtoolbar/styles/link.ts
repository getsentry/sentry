import {css} from '@emotion/react';

export const inlineLinkCss = css`
  color: var(--blue300);
  text-decoration: underline;
  text-decoration-color: var(--blue100);
  cursor: pointer;

  &:hover {
    text-decoration-color: var(--blue200);
  }
`;

export const blockLinkCss = css`
  color: var(--gray500);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-decoration-color: var(--gray200);
  }
`;
