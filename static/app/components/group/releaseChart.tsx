import * as React from 'react';
import styled from '@emotion/styled';

import MiniBarChart from 'sentry/components/charts/miniBarChart';
import Count from 'sentry/components/count';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Release, TimeseriesValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {formatVersion} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

import SidebarSection from './sidebarSection';

type Markers = React.ComponentProps<typeof MiniBarChart>['markers'];

/**
 * Stats are provided indexed by statsPeriod strings.
 */
type StatsGroup = Record<string, TimeseriesValue[]>;

type Props = {
  group: Group;
  statsPeriod: string;
  title: string;
  className?: string;
  environment?: string;
  environmentStats?: StatsGroup;
  firstSeen?: string;
  lastSeen?: string;
  release?: Release;
  releaseStats?: StatsGroup;
};

function GroupReleaseChart(props: Props) {
  const {
    className,
    group,
    lastSeen,
    firstSeen,
    statsPeriod,
    release,
    releaseStats,
    environment,
    environmentStats,
    title,
  } = props;

  const stats = group.stats[statsPeriod];
  if (!stats || !stats.length) {
    return null;
  }
  const series: Series[] = [];
  // Add all events.
  series.push({
    seriesName: t('Events'),
    data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
  });

  // Get the timestamp of the first point.
  const firstTime = series[0].data[0].value;

  if (environment && environmentStats) {
    series.push({
      seriesName: t('Events in %s', environment),
      data: environmentStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
    });
  }

  if (release && releaseStats) {
    series.push({
      seriesName: t('Events in release %s', formatVersion(release.version)),
      data: releaseStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
    });
  }

  const markers: Markers = [];
  if (firstSeen) {
    const firstSeenX = new Date(firstSeen).getTime();
    if (firstSeenX >= firstTime) {
      markers.push({
        name: t('First seen'),
        value: firstSeenX,
        color: theme.pink300,
      });
    }
  }

  if (lastSeen) {
    const lastSeenX = new Date(lastSeen).getTime();
    if (lastSeenX >= firstTime) {
      markers.push({
        name: t('Last seen'),
        value: lastSeenX,
        color: theme.green300,
      });
    }
  }

  const totalSeries =
    environment && environmentStats ? environmentStats[statsPeriod] : stats;
  const totalEvents = totalSeries.reduce((acc, current) => acc + current[1], 0);

  return (
    <SidebarSection secondary title={title} className={className}>
      <TotalEventCount value={totalEvents} />
      <MiniBarChart
        isGroupedByDate
        showTimeInTooltip
        height={42}
        series={series}
        markers={markers}
      />
    </SidebarSection>
  );
}

export default GroupReleaseChart;

const TotalEventCount = styled(Count)`
  display: block;
  margin-bottom: -${space(1)};
`;
