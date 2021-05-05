import styled from '@emotion/styled';

export const DividerSpacer = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.border};
`;

const MINI_HEADER_HEIGHT = 20;

export const ScrollbarContainer = styled('div')`
  display: block;
  width: 100%;
  height: ${MINI_HEADER_HEIGHT + 50}px;
  & > div[data-type='virtual-scrollbar'].dragging > div {
    background-color: ${p => p.theme.textColor};
    opacity: 0.8;
    cursor: grabbing;
  }
  overflow-x: scroll;
`;

export const VirtualScrollbar = styled('div')`
  height: 8px;
  width: 0;
  padding-left: 4px;
  padding-right: 4px;
  position: sticky;
  top: ${(MINI_HEADER_HEIGHT - 8) / 2}px;
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
