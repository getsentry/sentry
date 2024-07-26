import {css} from '@emotion/react';

export const resetDialogCss = css`
  background: transparent;
  height: auto;
  margin: 0;
  padding: 0;
  position: relative;
  width: auto;
`;

export const resetFlexColumnCss = css`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

export const resetFlexRowCss = css`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
`;

export const resetUlCss = css`
  padding: 0;
  margin: 0;
  list-style: none;
`;

export const resetButtonCss = css`
  align-items: center;
  background: none;
  border: none;
  display: flex;
  &:not(:disabled) {
    cursor: pointer;
  }
  line-height: 1em;
  position: relative;
`;
