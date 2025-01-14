import {t} from 'sentry/locale';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import useTruncatedReleaseNames from 'sentry/views/insights/mobile/common/queries/useTruncatedRelease';
import {TOP_SCREENS} from 'sentry/views/insights/mobile/constants';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';

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

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const [singularTopScreenTitle, pluralTopScreenTitle] = TITLES[yAxis];

  return countTopScreens > 1 ? pluralTopScreenTitle : singularTopScreenTitle;
}

export function TopScreensChart({
  yAxis,
  topTransactions,
  transformedReleaseEvents,
  chartHeight,
  isLoading,
}: any) {
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
