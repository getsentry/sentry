import {css} from '@emotion/react';

import {resetUlCss} from './reset';

export const infiniteListParentContainerCss = css`
  contain: strict;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  width: 100%;
`;

export const infiniteListScollablePanelCss = css`
  width: 100%;
  position: relative;
`;

export const infiniteListScrollableWindowCss = css`
  ${resetUlCss}
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
`;

export const panelScrollableCss = css`
  position: relative;
  height: 100%;
  overflow: scroll;
  border-radius: 0;
`;

export const infiniteListFloatingMessageBottomCss = css`
  align-items: center;
  bottom: 0;
  display: flex;
  flex-grow: 1;
  justify-content: center;
  position: absolute;
  width: 100%;
  z-index: 1;
`;
