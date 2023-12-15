import omit from 'lodash/omit';

import {BarChart} from 'sentry/components/charts/barChart';
import BaseChart from 'sentry/components/charts/baseChart';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import AppStartBreakdown, {
  COLD_START_COLOR,
  WARM_START_COLOR,
} from 'sentry/views/starfish/views/appStartup/appStartBreakdown';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

const BAR_WIDTH = '20px';

function AppStartBreakdownWidget({height}) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const location = useLocation();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    // 'event.type:transaction',
    // 'transaction.op:ui.load',
    // ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {data, isLoading, isError} = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', 'span.op', 'count()'],
        topEvents: '2',
        query: `${queryString} span.op:[app.start.warm,app.start.cold]`,
        dataset: DiscoverDatasets.SPANS_METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-breakdown',
    initialData: {data: []},
  });

  if (isLoading) {
    return <LoadingContainer isLoading />;
  }

  if (!data) {
    return null;
  }

  console.log(data);
  // const startsByReleaseSeries = data.data.reduce((acc, row) => {
  //   if (!acc['span.op']) {
  //     acc['span.op']
  //   }

  //   return acc;
  // }, {});

  // const series = data.data.reduce((acc, row) => {
  //   if (!acc[row['span.op']]) {
  //     // set up the default bar series
  //     acc[row['span.op']] = {
  //       name: row['span.op'],
  //       color: row['span.op'] === 'app.start.cold' ? COLD_START_COLOR : WARM_START_COLOR,
  //       type: 'bar',
  //       stack: 'stack',
  //       barWidth: BAR_WIDTH,
  //       emphasis: {
  //         focus: 'series',
  //       },
  //       data: [],
  //     };
  //   }

  //   acc[row['span.op']].data.push({name: row.release, value: row['count()']});

  //   return acc;
  // }, {});

  // console.log(startsByRelease);

  // const keys = {coldStartKey: 'app.start.cold', warmStartKey: 'app.start.warm'};

  const yAxisLabels: string[] = [];
  if (secondaryRelease) {
    yAxisLabels.push(secondaryRelease);
  }
  if (primaryRelease) {
    yAxisLabels.push(primaryRelease);
  }

  console.log(yAxisLabels);
  return (
    <MiniChartPanel
      title={t('App Start')}
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              formatVersionAndCenterTruncate(primaryRelease, 12),
              secondaryRelease ? formatVersionAndCenterTruncate(secondaryRelease, 12) : ''
            )
          : ''
      }
    >
      <BaseChart
        showTimeInTooltip={false}
        yAxis={{
          type: 'category',
          data: yAxisLabels,
          axisLabel: {
            formatter: value => formatVersion(value),
          },
        }}
        xAxis={{type: 'value'}}
        legend={{show: true, right: 0}}
        height={height}
        grid={{
          left: '20px',
          right: '0',
          top: '8px',
          bottom: '0',
          containLabel: true,
        }}
        series={[
          {
            name: 'app.start.cold',
            color: COLD_START_COLOR,
            type: 'bar',
            stack: 'stack',
            barWidth: BAR_WIDTH,
            emphasis: {
              focus: 'series',
            },
            data: [
              {name: secondaryRelease ?? '', value: 0.7},
              {name: primaryRelease ?? '', value: 0.3},
            ],
          },
          {
            name: 'app.start.warm',
            color: WARM_START_COLOR,
            type: 'bar',
            stack: 'stack',
            emphasis: {
              focus: 'series',
            },
            barWidth: BAR_WIDTH,
            data: [
              {name: secondaryRelease ?? '', value: 0.3},
              {name: primaryRelease ?? '', value: 0.7},
            ],
          },
        ]}
      />
    </MiniChartPanel>
  );
}

export default AppStartBreakdownWidget;
