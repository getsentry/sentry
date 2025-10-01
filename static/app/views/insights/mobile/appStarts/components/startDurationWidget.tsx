import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
// TODO(release-drawer): Only used in mobile/appStarts/components/
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useTopNSpanSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {Referrer} from 'sentry/views/insights/mobile/appStarts/referrers';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import type {SpanProperty} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

const COLD_START_CONDITIONS = [
  'span.op:app.start.cold',
  'span.description:["Cold Start","Cold App Start"]',
];
const WARM_START_CONDITIONS = [
  'span.op:app.start.warm',
  'span.description:["Warm Start","Warm App Start"]',
];

interface Props {
  additionalFilters?: string[];
}

function StartDurationWidget({additionalFilters}: Props) {
  const location = useLocation();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const startType =
    decodeScalar(location.query[SpanFields.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([
    ...(startType === COLD_START_TYPE ? COLD_START_CONDITIONS : WARM_START_CONDITIONS),
    ...(additionalFilters ?? []),
  ]);

  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);
  const search = new MutableSearch(queryString);
  const referrer = Referrer.MOBILE_APP_STARTS_DURATION_CHART;
  const groupBy = SpanFields.RELEASE;
  const yAxis: SpanProperty = 'avg(span.duration)';

  const {
    data,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useTopNSpanSeries(
    {
      yAxis: [yAxis],
      fields: [groupBy, 'avg(span.duration)'],
      topN: 2,
      search,
      enabled: !isReleasesLoading,
    },
    referrer
  );

  // Only transform the data is we know there's at least one release
  const sortedSeries = data
    .sort((releaseA, _releaseB) => (releaseA.seriesName === primaryRelease ? -1 : 1))
    .map(serie => ({
      ...serie,
      seriesName: `${yAxis} ${serie.seriesName}`,
    }));

  return (
    <InsightsLineChartWidget
      title={
        startType === COLD_START_TYPE ? t('Average Cold Start') : t('Average Warm Start')
      }
      series={sortedSeries}
      isLoading={isSeriesLoading}
      error={seriesError}
      queryInfo={{search, groupBy: [groupBy], referrer}}
      showReleaseAs="none"
      showLegend="always"
      height={220}
    />
  );
}

export default StartDurationWidget;
