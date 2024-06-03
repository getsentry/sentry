import {t} from 'sentry/locale';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/constants';
import {ScreensBarChart} from 'sentry/views/performance/mobile/screenload/screens/screenBarChart';
import useTruncatedReleaseNames from 'sentry/views/performance/mobile/useTruncatedRelease';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';

function getChartTitle(yAxis: string, countTopScreens: number) {
  const TITLES = {
    ['avg(mobile.slow_frames)']: [
      t('Top Screen Slow Frames'),
      t('Top %s Screen Slow Frames', countTopScreens),
    ],
    ['avg(mobile.frozen_frames)']: [
      t('Top Screen Frozen Frames'),
      t('Top %s Screen Frozen Frames', countTopScreens),
    ],
    ['avg(mobile.frames_delay)']: [
      t('Top Screen Frames Delay'),
      t('Top %s Screen Frames Delay', countTopScreens),
    ],
  };

  const [singularTopScreenTitle, pluralTopScreenTitle] = TITLES[yAxis];

  return countTopScreens > 1 ? pluralTopScreenTitle : singularTopScreenTitle;
}

export function TopScreensChart({
  yAxis,
  topTransactions,
  transformedReleaseEvents,
  chartHeight,
  isLoading,
}) {
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();

  const countTopScreens = Math.min(TOP_SCREENS, topTransactions.length);

  return (
    <ScreensBarChart
      chartOptions={[
        {
          title: getChartTitle(yAxis, countTopScreens),
          yAxis,
          xAxisLabel: topTransactions,
          series: Object.values(transformedReleaseEvents[yAxis]),
          subtitle: primaryRelease
            ? t(
                '%s v. %s',
                truncatedPrimaryRelease,
                secondaryRelease ? truncatedSecondaryRelease : ''
              )
            : '',
        },
      ]}
      chartHeight={chartHeight}
      isLoading={isLoading}
      chartKey={`${yAxis}-screen-chart`}
    />
  );
}
