import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';

export const StyledPanel = styled(Panel)`
  margin-bottom: 0px;
`;

export const StyledPanelHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  white-space: nowrap;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
`;

export const TracePanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 116px auto repeat(2, min-content) 85px 112px 66px;
`;

export const StyledPanelItem = styled(PanelItem)<{
  align?: 'left' | 'center' | 'right';
  overflow?: boolean;
  span?: number;
}>`
  align-items: center;
  padding: ${space(1)} ${space(2)};
  ${p => (p.align === 'left' ? 'justify-content: flex-start;' : null)}
  ${p => (p.align === 'right' ? 'justify-content: flex-end;' : null)}
  ${p => (p.overflow ? p.theme.overflowEllipsis : null)};
  ${p =>
    p.align === 'center'
      ? `
  justify-content: space-around;`
      : p.align === 'left' || p.align === 'right'
        ? `text-align: ${p.align};`
        : undefined}
  ${p => p.span && `grid-column: auto / span ${p.span};`}
  white-space: nowrap;
`;

export const MoreMatchingSpans = styled(StyledPanelItem)`
  color: ${p => p.theme.gray300};
`;

export const WrappingText = styled('div')`
  width: 100%;
  ${p => p.theme.overflowEllipsis};
`;

export const StyledSpanPanelItem = styled(StyledPanelItem)`
  &:nth-child(10n + 1),
  &:nth-child(10n + 2),
  &:nth-child(10n + 3),
  &:nth-child(10n + 4),
  &:nth-child(10n + 5) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

export const SpanTablePanelItem = styled(StyledPanelItem)`
  background-color: ${p => p.theme.gray100};
`;

export const BreakdownPanelItem = styled(StyledPanelItem)<{highlightedSliceName: string}>`
  ${p =>
    p.highlightedSliceName
      ? css`
          --highlightedSlice-${p.highlightedSliceName}-opacity: 1;
          --highlightedSlice-${p.highlightedSliceName}-saturate: saturate(1) contrast(1);
          --highlightedSlice-${p.highlightedSliceName}-transform: translateY(0px);
       `
      : null}
  ${p =>
    p.highlightedSliceName
      ? css`
          --defaultSlice-opacity: 1;
          --defaultSlice-saturate: saturate(0.7) contrast(0.9) brightness(1.2);
          --defaultSlice-transform: translateY(0px);
        `
      : css`
          --defaultSlice-opacity: 1;
          --defaultSlice-saturate: saturate(1) contrast(1);
          --defaultSlice-transform: translateY(0px);
        `}
`;

export const EmptyStateText = styled('div')<{
  size: 'fontSizeExtraLarge' | 'fontSizeMedium';
}>`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme[p.size]};
  padding-bottom: ${space(1)};
`;

export const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export const SpanPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 100px auto repeat(1, min-content) 160px 85px;
`;
