import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {type EventsMetaType} from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
// TODO(release-drawer): Only used in mobile/screenload/components/
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {type DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useTopNMetricsMultiSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverMultiSeries';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {
  CHART_TITLES,
  YAXIS_COLUMNS,
} from 'sentry/views/insights/mobile/screenload/constants';
import {Referrer} from 'sentry/views/insights/mobile/screenload/referrers';
import {SpanFields} from 'sentry/views/insights/types';

enum YAxis {
  WARM_START = 0,
  COLD_START = 1,
  TTID = 2,
  TTFD = 3,
  SLOW_FRAME_RATE = 4,
  FROZEN_FRAME_RATE = 5,
  THROUGHPUT = 6,
  COUNT = 7,
}

type Props = {
  additionalFilters?: string[];
  chartHeight?: number;
};

const yAxes = [YAxis.TTID, YAxis.TTFD, YAxis.COUNT];

export function ScreenCharts({additionalFilters}: Props) {
  const useEap = useInsightsEap();
  const theme = useTheme();
  const {isProjectCrossPlatform, selectedPlatform: platform} = useCrossPlatformProject();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryString = useMemo(() => {
    const query = new MutableSearch([
      useEap ? 'is_transaction:true' : 'event.type:transaction',
      'transaction.op:[ui.load,navigation]',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      query.addFilterValue('os.name', platform);
    }

    if (useEap) {
      query.addFilterValue('is_transaction', 'true');
    }

    return appendReleaseFilters(query, primaryRelease, secondaryRelease);
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    platform,
    primaryRelease,
    secondaryRelease,
    useEap,
  ]);

  const search = new MutableSearch(queryString);
  const groupBy = SpanFields.RELEASE;
  const referrer = Referrer.SCREENLOAD_LANDING_DURATION_CHART;

  const {
    data: releaseSeriesArray,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useTopNMetricsMultiSeries(
    {
      fields: [groupBy],
      topN: 2,
      yAxis: [
        'avg(measurements.time_to_initial_display)',
        'avg(measurements.time_to_full_display)',
        'count()',
      ],
      search,
    },
    referrer
  );

  useEffect(() => {
    if (defined(primaryRelease) || isReleasesLoading) {
      return;
    }
    Sentry.captureException(new Error('Screen summary missing releases'));
  }, [primaryRelease, isReleasesLoading]);

  const transformedReleaseSeries: Record<string, Record<string, Series>> = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
  });

  const seriesMap: Record<
    | 'avg(measurements.time_to_initial_display)'
    | 'avg(measurements.time_to_full_display)'
    | 'count()',
    DiscoverSeries[]
  > = {
    'avg(measurements.time_to_initial_display)': [],
    'avg(measurements.time_to_full_display)': [],
    'count()': [],
  };

  let chartAliases = {};
  const meta: EventsMetaType = {
    fields: {},
    units: {},
  };

  if (defined(releaseSeriesArray)) {
    releaseSeriesArray.forEach(release => {
      const releaseName = release.name;
      const isPrimary = releaseName === primaryRelease;
      const colors = theme.chart.getColorPalette(3);
      const color = isPrimary ? colors[0] : colors[1];
      const version = formatVersion(releaseName, true);

      const seriesNames = [
        'avg(measurements.time_to_initial_display)',
        'avg(measurements.time_to_full_display)',
        'count()',
      ] as const;

      seriesNames.forEach(seriesName => {
        const releaseSeries = release.data[seriesName];
        const newSeriesName = `${seriesName} ${version}`;
        chartAliases = {
          ...chartAliases,
          [newSeriesName]: version,
        };

        if (releaseSeries.meta?.fields[seriesName]) {
          meta.fields[newSeriesName] = releaseSeries.meta?.fields[seriesName];
        }

        if (releaseSeries.meta?.units[seriesName]) {
          meta.units[newSeriesName] = releaseSeries.meta?.units[seriesName];
        }

        seriesMap[seriesName].push({
          data: releaseSeries.data,
          meta,
          color,
          seriesName: newSeriesName,
        });
      });
    });
  }

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert.Container>
        <Alert type="warning" showIcon>
          {t('Invalid selection. Try a different release or date range.')}
        </Alert>
      </Alert.Container>
    );
  }

  function renderCharts() {
    return (
      <Fragment>
        <ChartContainer>
          <ScreensBarChart search={search} type="ttid" chartHeight={150} />
          <InsightsLineChartWidget
            queryInfo={{search, groupBy: [groupBy], referrer}}
            title={t('Average TTID')}
            series={seriesMap['avg(measurements.time_to_initial_display)']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height={'100%'}
          />
          <InsightsLineChartWidget
            queryInfo={{search, groupBy: [groupBy], referrer}}
            title={CHART_TITLES[YAxis.COUNT]}
            series={seriesMap['count()']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height={'100%'}
          />
          <ScreensBarChart search={search} type="ttfd" chartHeight={150} />
          <InsightsLineChartWidget
            queryInfo={{search, groupBy: [groupBy], referrer}}
            title={t('Average TTFD')}
            series={seriesMap['avg(measurements.time_to_full_display)']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height={'100%'}
          />
        </ChartContainer>
      </Fragment>
    );
  }

  return <div data-test-id="starfish-mobile-view">{renderCharts()}</div>;
}

const ChartContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  padding-bottom: ${space(2)};
`;
