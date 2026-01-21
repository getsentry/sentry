import {useCallback} from 'react';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import type {SelectionCallbackParams} from 'sentry/components/charts/useChartXRangeSelection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import useRouter from 'sentry/utils/useRouter';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import type {Mode} from 'sentry/views/explore/queryParams/mode';

import {useChartSelection} from './chartSelectionContext';

type Props = {
  chartIndex: number;
  params: SelectionCallbackParams;
  setTab: (tab: Mode | Tab) => void;
};

export function FloatingTrigger({chartIndex, params, setTab}: Props) {
  const router = useRouter();
  const {setChartSelection} = useChartSelection();
  const {selectionState, setSelectionState, clearSelection} = params;

  const handleZoomIn = useCallback(() => {
    if (!selectionState) return;

    const coordRange = selectionState.selection.range;
    let startTimestamp = coordRange[0];
    let endTimestamp = coordRange[1];

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

    clearSelection();
  }, [clearSelection, selectionState, router]);

  const handleFindAttributeBreakdowns = useCallback(() => {
    if (!selectionState) return;

    setSelectionState({
      ...selectionState,
      isActionMenuVisible: false,
    });
    setChartSelection({
      selection: selectionState.selection,
      chartIndex,
    });
    setTab(Tab.ATTRIBUTE_BREAKDOWNS);
  }, [selectionState, setSelectionState, chartIndex, setChartSelection, setTab]);

  return (
    <List>
      <ListItem onClick={handleZoomIn}>{t('Zoom in')}</ListItem>
      <ListItem onClick={handleFindAttributeBreakdowns}>
        {t('Compare Attribute Breakdowns')}
      </ListItem>
      <ListItem onClick={() => clearSelection()}>{t('Clear Selection')}</ListItem>
    </List>
  );
}

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
  transform: translateY(-20px);
`;

const ListItem = styled('li')`
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  cursor: pointer;
  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
