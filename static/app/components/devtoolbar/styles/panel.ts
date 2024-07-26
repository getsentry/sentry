import {css} from '@emotion/react';

export const panelCss = css`
  background: white;
  border-radius: 12px;
  border: 1px solid var(--gray100);
  height: 90vh;
  max-height: 560px;
  width: 320px;
  max-width: 320px;
  box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.1);
`;

export const panelHeadingCss = css`
  margin: 0;
  text-align: center;
`;

export const panelHeadingLeftCss = css`
  position: absolute;
  left: 0;
`;

export const panelHeadingRightCss = css`
  position: absolute;
  right: 0;
`;

export const panelSectionCss = css`
  position: relative;
  padding-block: var(--space100);
  &:not(:last-child) {
    border-bottom: 1px solid var(--gray200);
  }
`;

export const panelInsetContentCss = css`
  padding-inline: var(--space150);
`;
