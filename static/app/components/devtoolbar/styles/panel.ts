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
  padding: 0 0 0 var(--space200);
  text-align: left;
  border-bottom: 1px solid var(--gray200);
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
  padding-block: var(--space75);
  &:not(:last-child) {
    border-bottom: 1px solid var(--gray200);
  }
`;

export const panelSectionCssNoBorder = css`
  position: relative;
  padding-block: var(--space150);
`;

export const panelInsetContentCss = css`
  padding-inline: var(--space150);
`;

export const verticalPaddingCss = css`
  padding: var(--space150) 0;
`;

export const panelDescCss = css`
  color: var(--gray300);
  font-weight: bold;
  margin: 0 var(--space150);
  text-align: left;
  padding-top: var(--space200);
`;

export const buttonRightCss = css`
  display: flex;
  gap: var(--space75);
  align-items: center;
  color: var(--purple300);
  font-weight: bold;
`;
