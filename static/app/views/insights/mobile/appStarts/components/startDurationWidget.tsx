import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
// TODO(release-drawer): Only used in mobile/appStarts/components/
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
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
  const {primaryRelease, isLoading: isReleasesLoading} = useReleaseSelection();
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

  const queryString = appendReleaseFilters(query, primaryRelease);
  const search = new MutableSearch(queryString);
  const referrer = Referrer.MOBILE_APP_STARTS_DURATION_CHART;
  const groupBy = primaryRelease ? SpanFields.RELEASE : SpanFields.TRANSACTION;
  const yAxis: SpanProperty = 'avg(span.duration)';

  const {
    data,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useFetchSpanTimeSeries(
    {
      yAxis: [yAxis],
      groupBy: [groupBy],
      topEvents: 2,
      query: search,
      enabled: !isReleasesLoading,
    },
    referrer
  );

  const timeSeries = data?.timeSeries || [];

  // Only transform the data is we know there's at least one release
  const sortedSeries = timeSeries.sort((releaseA, _releaseB) =>
    releaseA.groupBy?.[0]?.value === primaryRelease ? -1 : 1
  );

  // If multiple releases are present, we need to set the yAxis to the release name,
  // otherwise all will show "Avg. Duration" in the legend
  timeSeries.forEach(release => {
    const releaseName = release.groupBy?.find(entry => entry.key === 'release')?.value;
    if (releaseName && typeof releaseName === 'string') {
      release.yAxis = releaseName;
    }
  });

  return (
    <InsightsLineChartWidget
      title={
        startType === COLD_START_TYPE ? t('Average Cold Start') : t('Average Warm Start')
      }
      timeSeries={sortedSeries}
      isLoading={isSeriesLoading}
      error={seriesError}
      queryInfo={{search, groupBy: [groupBy], referrer}}
      showReleaseAs="none"
      showLegend={primaryRelease ? 'always' : 'never'}
      height={220}
    />
  );
}

export default StartDurationWidget;
