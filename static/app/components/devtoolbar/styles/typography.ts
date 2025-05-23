import {css} from '@emotion/react';

export const buttonCss = css`
  font-weight: 600;
  font-size: 1rem;
  line-height: 1;
  letter-spacing: normal;
`;

export const smallCss = css`
  font-weight: 400;
  font-size: 0.875rem;
  line-height: 1.4;
  letter-spacing: +0.01rem;
`;

export const xSmallCss = css`
  font-weight: 400;
  font-size: 0.75rem;
  line-height: 1.4;
  letter-spacing: +0.02rem;
`;

export const textOverflowTwoLinesCss = css`
  margin: 0;
  white-space: initial;
  height: 2.8em;
  -webkit-line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-height: 1.2rem;
`;
