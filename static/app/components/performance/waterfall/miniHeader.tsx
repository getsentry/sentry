import styled from '@emotion/styled';

export const DividerSpacer = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.border};
`;

const MINI_HEADER_HEIGHT = 20;

export const ScrollbarContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${MINI_HEADER_HEIGHT}px;
  left: 0;
  bottom: 0;
  & > div[data-type='virtual-scrollbar'].dragging > div {
    background-color: ${p => p.theme.textColor};
    opacity: 0.8;
    cursor: grabbing;
  }
`;

export const VirtualScrollbar = styled('div')`
  height: 8px;
  width: 0;
  padding-left: 4px;
  padding-right: 4px;
  position: relative;
  top: 0;
  left: 0;
  cursor: grab;
`;

export const VirtualScrollbarGrip = styled('div')`
  height: 8px;
  width: 100%;
  border-radius: 20px;
  transition: background-color 150ms ease;
  background-color: ${p => p.theme.textColor};
  opacity: 0.5;
`;
