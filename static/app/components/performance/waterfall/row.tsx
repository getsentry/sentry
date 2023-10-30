import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';
import {getBackgroundColor} from 'sentry/components/performance/waterfall/utils';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import toPercent from 'sentry/utils/number/toPercent';

interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor?: 'pointer' | 'default';
  showBorder?: boolean;
  visible?: boolean;
}

export const Row = styled('div')<RowProps>`
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

type RowCellProps = {
  showDetail?: boolean;
  showStriping?: boolean;
};

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
  display: flex;
  align-items: center;
`;

export function RowReplayTimeIndicators() {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const durationMs = replay?.getDurationMs();

  if (!replay || !durationMs) {
    return null;
  }

  return (
    <Fragment>
      <RowIndicatorBar style={{left: toPercent(currentTime / durationMs)}} />
      {currentHoverTime !== undefined ? (
        <RowHoverIndicatorBar style={{left: toPercent(currentHoverTime / durationMs)}} />
      ) : null}
    </Fragment>
  );
}

const RowIndicatorBar = styled('div')`
  background: ${p => p.theme.purple300};
  content: '';
  display: block;
  height: 100%;
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  width: 1px;
  z-index: 1;
`;

const RowHoverIndicatorBar = styled(RowIndicatorBar)`
  background: ${p => p.theme.purple200};
`;
