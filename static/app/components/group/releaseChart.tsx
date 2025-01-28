import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {BarChartSeries} from 'sentry/components/charts/barChart';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import Count from 'sentry/components/count';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import type {TimeseriesValue} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import {getFormattedDate} from 'sentry/utils/dates';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

/**
 * Stats are provided indexed by statsPeriod strings.
 */
type StatsGroup = Record<string, TimeseriesValue[]>;

interface Props {
  group: Group;
  statsPeriod: string;
  title: string;
  className?: string;
  environment?: string;
  environmentLabel?: string;
  environmentStats?: StatsGroup;
  firstSeen?: string;
  lastSeen?: string;
  release?: Release;
  releaseStats?: StatsGroup;
}

type Marker = {
  color: string;
  displayValue: string | number | Date;
  name: string;
  value: string | number | Date;
};

export function getGroupReleaseChartMarkers(
  theme: Theme,
  stats: TimeseriesValue[],
  firstSeen?: string,
  lastSeen?: string
): BarChartSeries['markPoint'] {
  const markers: Marker[] = [];
  // Get the timestamp of the first point.
  const firstGraphTime = stats[0]![0] * 1000;

  const firstSeenX = new Date(firstSeen ?? 0).getTime();
  const lastSeenX = new Date(lastSeen ?? 0).getTime();
  const difference = lastSeenX - firstSeenX;
  const oneHourMs = 1000 * 60 * 60;

  if (
    firstSeen &&
    stats.length > 2 &&
    firstSeenX >= firstGraphTime &&
    // Don't show first seen if the markers are too close together
    difference > oneHourMs
  ) {
    // Find the first bucket that would contain our first seen event
    const firstBucket = stats.findIndex(([time]) => time * 1000 > firstSeenX);

    let bucketStart: number | undefined;
    if (firstBucket > 0) {
      // The size of the data interval in ms
      const halfBucketSize = ((stats[1]![0] - stats[0]![0]) * 1000) / 2;
      // Display the marker in front of the first bucket
      bucketStart = stats[firstBucket - 1]![0] * 1000 - halfBucketSize;
    }

    markers.push({
      name: t('First seen'),
      value: bucketStart ?? firstSeenX,
      displayValue: firstSeenX,
      color: theme.pink300,
    });
  }

  if (lastSeen && lastSeenX >= firstGraphTime) {
    markers.push({
      name: t('Last seen'),
      value: lastSeenX,
      displayValue: lastSeenX,
      color: theme.green300,
    });
  }

  const markerTooltip = {
    show: true,
    trigger: 'item',
    formatter: ({data}: any) => {
      const time = getFormattedDate(data.displayValue, 'MMM D, YYYY LT', {
        local: true,
      });
      return [
        '<div class="tooltip-series">',
        `<div><span class="tooltip-label"><strong>${data.name}</strong></span></div>`,
        '</div>',
        `<div class="tooltip-footer">${time}</div>`,
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };

  return {
    data: markers.map(marker => ({
      name: marker.name,
      coord: [marker.value, 0],
      tooltip: markerTooltip,
      displayValue: marker.displayValue,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: marker.color,
        borderColor: theme.background,
      },
    })),
  };
}

function GroupReleaseChart(props: Props) {
  const {
    group,
    lastSeen,
    firstSeen,
    statsPeriod,
    release,
    releaseStats,
    environment,
    environmentLabel,
    environmentStats,
    title,
  } = props;
  const theme = useTheme();

  const stats = group.stats[statsPeriod];
  const environmentPeriodStats = environmentStats?.[statsPeriod];
  if (!stats || !stats.length || !environmentPeriodStats) {
    return null;
  }

  const series: BarChartSeries[] = [];

  if (environment) {
    // Add all events.
    series.push({
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    });
  }

  series.push({
    seriesName: t('Events in %s', environmentLabel),
    data: environmentStats[statsPeriod]!.map(point => ({
      name: point![0] * 1000,
      value: point![1],
    })),
  });

  if (release && releaseStats) {
    series.push({
      seriesName: t('Events in release %s', formatVersion(release.version)),
      data: releaseStats[statsPeriod]!.map(point => ({
        name: point![0] * 1000,
        value: point![1],
      })),
    });
  }

  const totalSeries =
    environment && environmentStats ? environmentStats[statsPeriod] : stats;
  const totalEvents = totalSeries!.reduce((acc, current) => acc + current[1], 0);
  series[0]!.markPoint = getGroupReleaseChartMarkers(theme, stats, firstSeen, lastSeen);

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{title}</SidebarSection.Title>
      <SidebarSection.Content>
        <EventNumber>
          <Count value={totalEvents} />
        </EventNumber>
        <MiniBarChart
          isGroupedByDate
          showTimeInTooltip
          showMarkLineLabel
          height={42}
          colors={environment ? undefined : [theme.purple300, theme.purple300]}
          series={series}
          grid={{
            top: 6,
            bottom: 4,
            left: 4,
            right: 4,
          }}
        />
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const EventNumber = styled('div')`
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default GroupReleaseChart;
