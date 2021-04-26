import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'app/components/performance/waterfall/constants';
import {getBackgroundColor} from 'app/components/performance/waterfall/utils';
import {OmitHtmlDivProps} from 'app/utils';

type RowProps = {
  cursor?: 'pointer' | 'default';
  visible?: boolean;
  showBorder?: boolean;
};

type RowAndDivProps = Omit<React.HTMLProps<HTMLDivElement>, keyof RowProps> & RowProps;

export const Row = styled('div')<RowAndDivProps>`
  display: ${p => (p.visible ? 'block' : 'none')};
  border-top: ${p => (p.showBorder ? `1px solid ${p.theme.border}` : null)};
  margin-top: ${p => (p.showBorder ? '-1px' : null)}; /* to prevent offset on toggle */
  position: relative;
  overflow: hidden;
  min-height: ${ROW_HEIGHT}px;
  cursor: ${p => p.cursor ?? 'pointer'};
  transition: background-color 0.15s ease-in-out;

  &:last-child {
    & > [data-component='span-detail'] {
      border-bottom: none !important;
    }
  }
`;

type RowCellProps = OmitHtmlDivProps<{
  showStriping?: boolean;
  showDetail?: boolean;
}>;

export const RowCellContainer = styled('div')<RowCellProps>`
  display: flex;
  position: relative;
  height: ${ROW_HEIGHT}px;

  /* for virtual scrollbar */
  overflow: hidden;

  user-select: none;

  &:hover > div[data-type='span-row-cell'] {
    background-color: ${p =>
      p.showDetail ? p.theme.textColor : p.theme.backgroundSecondary};
  }
`;

export const RowCell = styled('div')<RowCellProps>`
  position: relative;
  height: 100%;
  overflow: hidden;
  background-color: ${p => getBackgroundColor(p)};
  transition: background-color 125ms ease-in-out;
  color: ${p => (p.showDetail ? p.theme.background : 'inherit')};
`;
