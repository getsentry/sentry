import styled from '@emotion/styled';

export const DividerLine = styled('div')<{showDetail?: boolean}>`
  background-color: ${p => (p.showDetail ? p.theme.textColor : p.theme.border)};
  position: absolute;
  height: 100%;
  width: 1px;
  transition: background-color 125ms ease-in-out;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};

  /* enhanced hit-box */
  &:after {
    content: '';
    z-index: -1;
    position: absolute;
    left: -2px;
    top: 0;
    width: 5px;
    height: 100%;
  }

  &.hovering {
    background-color: ${p => p.theme.textColor};
    width: 3px;
    transform: translateX(-1px);
    margin-right: -2px;

    cursor: ew-resize;

    &:after {
      left: -2px;
      width: 7px;
    }
  }
`;

export const DividerLineGhostContainer = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
`;
