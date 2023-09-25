import {Fragment} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {ViewsList} from 'sentry/views/starfish/views/mobileServiceView/viewsList';

const READABLE_YAXIS_LABELS = {
  'avg(measurements.app_start_cold)': 'avg(app_start_cold)',
  'avg(measurements.app_start_warm)': 'avg(app_start_warm)',
  'avg(measurements.time_to_initial_display)': 'avg(time_to_initial_display)',
  'avg(measurements.time_to_full_display)': 'avg(time_to_full_display)',
  'avg(measurements.frames_slow_rate)': 'avg(frames_slow_rate)',
  'avg(measurements.frames_frozen_rate)': 'avg(frames_frozen_rate)',
};

export function BrowserStarfishView() {
  const pageFilter = usePageFilters();
  const location = useLocation();

  const query = new MutableSearch(['transaction.op:ui.action.click']);

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  return (
    <div data-test-id="starfish-browser-view">
      <StyledRow minSize={300}>
        <ChartsContainer>{renderCharts()}</ChartsContainer>
      </StyledRow>
      <ViewsList />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

export const Spacer = styled('div')`
  margin-top: ${space(3)};
`;

const SubTitle = styled('div')`
  margin-bottom: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
`;
