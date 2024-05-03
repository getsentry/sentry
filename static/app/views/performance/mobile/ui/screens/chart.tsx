import {t} from 'sentry/locale';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/constants';
import {ScreensBarChart} from 'sentry/views/performance/mobile/screenload/screens/screenBarChart';
import useTruncatedReleaseNames from 'sentry/views/performance/mobile/useTruncatedRelease';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';

export function Chart({
  yAxis,
  topTransactions,
  transformedReleaseEvents,
  chartHeight,
  isLoading,
}) {
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();

  const countTopScreens = Math.min(TOP_SCREENS, topTransactions.length);

  // TODO
  const [singularTopScreenTitle, pluralTopScreenTitle] = [
    t('Top Screen Data'),
    t('Top %s Screen Data', countTopScreens),
  ];

  return (
    <ScreensBarChart
      chartOptions={[
        {
          title: countTopScreens > 1 ? pluralTopScreenTitle : singularTopScreenTitle,
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
