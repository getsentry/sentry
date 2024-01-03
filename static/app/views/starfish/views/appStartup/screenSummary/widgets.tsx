import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import CountWidget from 'sentry/views/starfish/views/appStartup/screenSummary/countWidget';
import DeviceClassBreakdownBarChart from 'sentry/views/starfish/views/appStartup/screenSummary/deviceClassBreakdownBarChart';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/starfish/views/screens';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {transformDeviceClassEvents} from 'sentry/views/starfish/views/screens/utils';

import AppStartBreakdownWidget from './appStartBreakdownWidget';

const YAXES = [YAxis.COLD_START, YAxis.WARM_START];

function SummaryWidgets({additionalFilters}) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {query: locationQuery} = location;
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([...(additionalFilters ?? [])]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  // Use single query for cold and warm starts by device classification and release
  const {
    data: startupDataByDeviceClass,
    isLoading,
    isError,
  } = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: [
          'avg(measurements.app_start_cold)',
          'avg(measurements.app_start_warm)',
          'device.class',
          'release',
        ],
        yAxis: YAXES.map(val => YAXIS_COLUMNS[val]),
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-bar-chart',
    initialData: {data: []},
  });

  const transformedData: {} = transformDeviceClassEvents({
    data: startupDataByDeviceClass,
    yAxes: YAXES,
    primaryRelease,
    secondaryRelease,
  });

  return (
    <WidgetLayout>
      <div style={{gridArea: '1 / 1 / 1 / 1'}}>
        <AppStartBreakdownWidget additionalFilters={additionalFilters} />
      </div>
      <div style={{gridArea: '2 / 1 / 2 / 1'}}>
        <CountWidget additionalFilters={additionalFilters} />
      </div>
      <div style={{gridArea: '1 / 2 / 1 / 2'}}>
        <DeviceClassBreakdownBarChart
          title={t('Cold Start')}
          isLoading={isLoading}
          isError={isError}
          data={Object.values(transformedData[YAXIS_COLUMNS[YAxis.COLD_START]])}
          yAxis={YAXIS_COLUMNS[YAxis.COLD_START]}
        />
      </div>
      <div style={{gridArea: '2 / 2 / 2 / 2'}}>
        <DeviceClassBreakdownBarChart
          title={t('Warm Start')}
          isLoading={isLoading}
          isError={isError}
          data={Object.values(transformedData[YAXIS_COLUMNS[YAxis.WARM_START]])}
          yAxis={YAXIS_COLUMNS[YAxis.WARM_START]}
        />
      </div>
    </WidgetLayout>
  );
}

export default SummaryWidgets;

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-columns: 33% 33% 33%;
  grid-template-rows: 140px 140px;
  gap: ${space(1)};
`;
