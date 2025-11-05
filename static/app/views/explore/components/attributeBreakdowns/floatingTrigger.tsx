import {useCallback} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import useRouter from 'sentry/utils/useRouter';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import type {Mode} from 'sentry/views/explore/queryParams/mode';

import {useChartSelection} from './chartSelectionContext';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
  setTab: (tab: Mode | Tab) => void;
  triggerWrapperRef: React.RefObject<HTMLDivElement | null>;
};

export function FloatingTrigger({
  boxSelectOptions,
  chartInfo,
  triggerWrapperRef,
  setTab,
}: Props) {
  const router = useRouter();
  const triggerPosition = boxSelectOptions.floatingTriggerPosition;
  const {setChartSelection} = useChartSelection();

  const handleZoomIn = useCallback(() => {
    const coordRange = boxSelectOptions.xRange;
    let startTimestamp = coordRange?.[0];
    let endTimestamp = coordRange?.[1];

    if (!startTimestamp || !endTimestamp) {
      return;
    }

    // round off the bounds to the minute
    startTimestamp = Math.floor(startTimestamp / 60_000) * 60_000;
    endTimestamp = Math.ceil(endTimestamp / 60_000) * 60_000;

    // ensure the bounds has 1 minute resolution
    startTimestamp = Math.min(startTimestamp, endTimestamp - 60_000);

    updateDateTime(
      {
        start: getUtcDateString(startTimestamp),
        end: getUtcDateString(endTimestamp),
      },
      router,
      {save: true}
    );
    boxSelectOptions.clearSelection();
  }, [boxSelectOptions, router]);

  const handleFindAttributeBreakdowns = useCallback(() => {
    setChartSelection({
      boxSelectOptions,
      chartInfo,
    });
    setTab(Tab.ATTRIBUTE_BREAKDOWNS);
  }, [boxSelectOptions, chartInfo, setChartSelection, setTab]);

  if (!triggerPosition) return null;

  return createPortal(
    <div
      ref={triggerWrapperRef}
      style={{
        position: 'absolute',
        top: triggerPosition.top,
        left: triggerPosition.left,
        zIndex: 1000,
      }}
    >
      <List>
        <ListItem onClick={handleZoomIn}>{t('Zoom in')}</ListItem>
        <ListItem onClick={handleFindAttributeBreakdowns}>
          {t('Find Attribute Breakdowns')}
        </ListItem>
      </List>
    </div>,
    document.body
  );
}

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
  background: ${p => p.theme.backgroundElevated};
  color: ${p => p.theme.textColor};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
`;

const ListItem = styled('li')`
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
