import styled from '@emotion/styled';

const Root = styled('div')`
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
`;

const HeaderViewport = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  min-width: 100%;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const HeaderRow = styled('div')`
  display: grid;
`;

const BodyScrollContainer = styled('div')`
  bottom: 0;
  inset-inline: 0;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  position: absolute;
  overscroll-behavior: contain;
  top: 0;
`;

const Content = styled('div')`
  position: relative;
`;

const NoRowsContainer = styled('div')`
  min-height: 100%;
`;

const Offset = styled('div')<{offset: number}>`
  left: 0;
  position: absolute;
  top: 0;
  transform: translateY(${p => p.offset}px);
`;

const BodyRow = styled('div')<{useTransparentBorders?: boolean}>`
  display: grid;
  position: relative;

  &.beforeHoverTime + &.afterHoverTime:before {
    border-top: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.moderate
          : p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeHoverTime.isLastDataRow:before {
    border-bottom: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.moderate
          : p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }

  &.beforeCurrentTime + &.afterCurrentTime:after {
    border-top: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.vibrant
          : p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeCurrentTime.isLastDataRow:after {
    border-bottom: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.vibrant
          : p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }
`;

export const VirtualTable = Object.assign(Root, {
  HeaderViewport,
  HeaderRow,
  BodyScrollContainer,
  NoRowsContainer,
  Content,
  Offset,
  BodyRow,
});
