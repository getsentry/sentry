import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {Tooltip} from 'sentry/components/tooltip';
import {IconTelescope} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  NewQuery,
} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useFetchEventStatsQuery} from 'sentry/views/issueDetails/streamline/useFetchEventStats';

export const enum EventGraphSeries {
  EVENT = 'event',
  USER = 'user',
}
interface EventGraphProps {
  group: Group;
  groupStats: MultiSeriesEventsStats;
  searchQuery: string;
}

function createSeriesAndCount(stats: EventsStats) {
  return stats?.data?.reduce(
    (result, [timestamp, countData]) => {
      const count = countData?.[0]?.count ?? 0;
      return {
        series: [
          ...result.series,
          {
            name: timestamp * 1000, // ms -> s
            value: count,
          },
        ],
        count: result.count + count,
      };
    },
    {series: [] as SeriesDataUnit[], count: 0}
  );
}

export function EventGraph({group, groupStats, searchQuery}: EventGraphProps) {
  const organization = useOrganization();
  const [visibleSeries, setVisibleSeries] = useState<EventGraphSeries>(
    EventGraphSeries.EVENT
  );
  const [isGraphHovered, setIsGraphHovered] = useState(false);
  const eventStats = groupStats['count()'];
  const {series: eventSeries, count: eventCount} = useMemo(
    () => createSeriesAndCount(eventStats),
    [eventStats]
  );
  const userStats = groupStats['count_unique(user)'];
  const {series: userSeries, count: userCount} = useMemo(
    () => createSeriesAndCount(userStats),
    [userStats]
  );
  const discoverStatsQuery = useFetchEventStatsQuery({
    group: group,
    query: searchQuery,
    referrer: 'issue_details.streamline_link',
  });

  const discoverUrl = useMemo(() => {
    const discoverQuery: NewQuery = {
      ...discoverStatsQuery,
      version: 2,
      projects: [discoverStatsQuery.project],
      range: discoverStatsQuery.statsPeriod,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      name: group.title || group.type,
    };
    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(
      organization.slug,
      false,
      hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
    );
  }, [group, organization, discoverStatsQuery]);

  const series: BarChartSeries[] = [];

  if (eventStats && visibleSeries === EventGraphSeries.USER) {
    series.push({
      seriesName: t('Users'),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        borderColor: theme.translucentGray200,
        color: theme.purple200,
      },
      stack: 'stats',
      data: userSeries,
    });
  }
  if (eventStats && visibleSeries === EventGraphSeries.EVENT) {
    series.push({
      seriesName: t('Events'),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        borderColor: theme.translucentGray200,
        color: theme.gray200,
      },
      stack: 'stats',
      data: eventSeries,
    });
  }

  return (
    <GraphWrapper>
      <SummaryContainer>
        <Callout
          onClick={() =>
            visibleSeries === EventGraphSeries.USER &&
            setVisibleSeries(EventGraphSeries.EVENT)
          }
          isActive={visibleSeries === EventGraphSeries.EVENT}
          disabled={visibleSeries === EventGraphSeries.EVENT}
        >
          <InteractionStateLayer hidden={visibleSeries === EventGraphSeries.EVENT} />
          <Label>{tn('Event', 'Events', eventCount)}</Label>
          <Count>{formatAbbreviatedNumber(eventCount)}</Count>
        </Callout>
        <Callout
          onClick={() =>
            visibleSeries === EventGraphSeries.EVENT &&
            setVisibleSeries(EventGraphSeries.USER)
          }
          isActive={visibleSeries === EventGraphSeries.USER}
          disabled={visibleSeries === EventGraphSeries.USER}
        >
          <InteractionStateLayer hidden={visibleSeries === EventGraphSeries.USER} />
          <Label>{tn('User', 'Users', userCount)}</Label>
          <Count>{formatAbbreviatedNumber(userCount)}</Count>
        </Callout>
      </SummaryContainer>
      <ChartContainer
        role="figure"
        onMouseEnter={() => setIsGraphHovered(true)}
        onMouseLeave={() => setIsGraphHovered(false)}
      >
        <BarChart
          height={100}
          series={series}
          isGroupedByDate
          showTimeInTooltip
          grid={{
            top: 8,
            left: 8,
            right: 8,
            bottom: 0,
          }}
          yAxis={{
            splitNumber: 2,
            axisLabel: {
              formatter: value => formatAbbreviatedNumber(value),
            },
          }}
        />
        {discoverUrl && isGraphHovered && (
          <OpenInDiscoverButton>
            <Tooltip title={t('Open in Discover')}>
              <LinkButton
                size="xs"
                icon={<IconTelescope />}
                to={discoverUrl}
                aria-label={t('Open in Discover')}
              />
            </Tooltip>
          </OpenInDiscoverButton>
        )}
      </ChartContainer>
    </GraphWrapper>
  );
}

const GraphWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
`;

const SummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: space(1);
  border-radius: ${p => p.theme.borderRadiusLeft};
`;

const Callout = styled('button')<{isActive: boolean}>`
  flex: 1;
  cursor: ${p => (p.isActive ? 'initial' : 'pointer')};
  outline: 0;
  position: relative;
  border: 1px solid ${p => p.theme.translucentInnerBorder};
  background: ${p => (p.isActive ? p.theme.background : p.theme.backgroundSecondary)};
  text-align: left;
  padding: ${space(1)} ${space(2)};
  &:first-child {
    border-radius: ${p => p.theme.borderRadius} 0 ${p => p.theme.borderRadius} 0;
    border-width: ${p => (p.isActive ? '0' : '0 1px 1px 0')};
  }
  &:last-child {
    border-radius: 0 ${p => p.theme.borderRadius} 0 ${p => p.theme.borderRadius};
    border-width: ${p => (p.isActive ? '0' : '1px 1px 0 0')};
  }
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1;
`;

const Count = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: ${space(0.5)};
  line-height: 1;
`;

const ChartContainer = styled('div')`
  padding: ${space(0.75)} ${space(1)} ${space(0.75)} 0;
  position: relative;
`;

const OpenInDiscoverButton = styled('div')`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
`;
