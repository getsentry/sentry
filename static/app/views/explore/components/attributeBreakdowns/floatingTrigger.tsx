import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {SelectionCallbackParams} from 'sentry/components/charts/useChartXRangeSelection';
import {updateDateTime} from 'sentry/components/pageFilters/actions';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import useLocation from 'sentry/utils/useLocation';
import useNavigate from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import type {Mode} from 'sentry/views/explore/queryParams/mode';

import {useChartSelection} from './chartSelectionContext';

type Props = {
  chartIndex: number;
  params: SelectionCallbackParams;
  setTab: (tab: Mode | Tab) => void;
};

export function FloatingTrigger({chartIndex, params, setTab}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {setChartSelection} = useChartSelection();
  const {selectionState, setSelectionState, clearSelection} = params;

  const handleZoomIn = useCallback(() => {
    if (!selectionState) return;

    trackAnalytics('explore.floating_trigger.zoom_in', {organization});

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
      {location, push: navigate, replace: path => navigate(path, {replace: true})},
      {save: true}
    );

    clearSelection();
  }, [clearSelection, selectionState, navigate, location, organization]);

  const handleFindAttributeBreakdowns = useCallback(() => {
    if (!selectionState) return;

    trackAnalytics('explore.floating_trigger.compare_attribute_breakdowns', {
      organization,
    });

    setSelectionState({
      ...selectionState,
      isActionMenuVisible: false,
    });
    setChartSelection({
      selection: selectionState.selection,
      chartIndex,
    });
    setTab(Tab.ATTRIBUTE_BREAKDOWNS);
  }, [
    selectionState,
    setSelectionState,
    chartIndex,
    setChartSelection,
    setTab,
    organization,
  ]);

  return (
    <List>
      <ListItem onClick={handleZoomIn}>{t('Zoom in')}</ListItem>
      <ListItem onClick={handleFindAttributeBreakdowns}>
        {t('Compare Attribute Breakdowns')}
      </ListItem>
      <ListItem
        onClick={() => {
          trackAnalytics('explore.floating_trigger.clear_selection', {organization});
          clearSelection();
        }}
      >
        {t('Clear Selection')}
      </ListItem>
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
  font-size: ${p => p.theme.font.size.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
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
