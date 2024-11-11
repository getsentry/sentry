import {type CSSProperties, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button, type ButtonProps} from 'sentry/components/button';
import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import Legend from 'sentry/components/charts/components/legend';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Flex} from 'sentry/components/container/flex';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Placeholder from 'sentry/components/placeholder';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getBucketSize} from 'sentry/views/dashboards/widgetCard/utils';
import useFlagSeries from 'sentry/views/issueDetails/streamline/useFlagSeries';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';
import {useReleaseMarkLineSeries} from 'sentry/views/issueDetails/streamline/useReleaseMarkLineSeries';

export const enum EventGraphSeries {
  EVENT = 'event',
  USER = 'user',
}

interface EventGraphProps {
  event: Event | undefined;
  group: Group;
  className?: string;
  style?: CSSProperties;
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

export function EventGraph({group, event, ...styleProps}: EventGraphProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const [visibleSeries, setVisibleSeries] = useState<EventGraphSeries>(
    EventGraphSeries.EVENT
  );
  const eventView = useIssueDetailsEventView({group});
  const hasFeatureFlagFeature = organization.features.includes('feature-flag-ui');

  const config = getConfigForIssueType(group, group.project);

  const {
    data: groupStats = {},
    isPending: isLoadingStats,
    error,
  } = useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
    params: {
      route: 'events-stats',
      eventView,
      referrer: 'issue_details.streamline_graph',
    },
  });

  const {data: uniqueUsersCount, isPending: isPendingUniqueUsersCount} = useApiQuery<{
    data: Array<{count_unique: number}>;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...eventView.getEventsAPIPayload(location),
          dataset: config.usesIssuePlatform
            ? DiscoverDatasets.ISSUE_PLATFORM
            : DiscoverDatasets.ERRORS,
          field: 'count_unique(user)',
          per_page: 50,
          project: group.project.id,
          query: eventView.query,
          referrer: 'issue_details.streamline_graph',
        },
      },
    ],
    {
      staleTime: 60_000,
    }
  );
  const userCount = uniqueUsersCount?.data[0]?.['count_unique(user)'] ?? 0;

  const {series: eventSeries, count: eventCount} = useMemo(() => {
    if (!groupStats['count()']) {
      return {series: [], count: 0};
    }
    return createSeriesAndCount(groupStats['count()']);
  }, [groupStats]);
  const userSeries = useMemo(() => {
    if (!groupStats['count_unique(user)']) {
      return [];
    }

    return createSeriesAndCount(groupStats['count_unique(user)']).series;
  }, [groupStats]);

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  const releaseSeries = useReleaseMarkLineSeries({group});
  const flagSeries = useFlagSeries({
    query: {
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
    },
    event,
  });

  const series = useMemo((): BarChartSeries[] => {
    const seriesData: BarChartSeries[] = [];

    if (visibleSeries === EventGraphSeries.USER) {
      seriesData.push({
        seriesName: t('Users'),
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          borderColor: theme.translucentGray200,
          color: theme.purple200,
        },
        stack: 'stats',
        data: userSeries,
        animation: false,
      });
    }
    if (visibleSeries === EventGraphSeries.EVENT) {
      seriesData.push({
        seriesName: t('Events'),
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          borderColor: theme.translucentGray200,
          color: theme.gray200,
        },
        stack: 'stats',
        data: eventSeries,
        animation: false,
      });
    }

    if (releaseSeries.markLine) {
      seriesData.push(releaseSeries as BarChartSeries);
    }

    if (flagSeries.markLine && hasFeatureFlagFeature) {
      seriesData.push(flagSeries as BarChartSeries);
    }

    return seriesData;
  }, [
    visibleSeries,
    userSeries,
    eventSeries,
    releaseSeries,
    flagSeries,
    theme,
    hasFeatureFlagFeature,
  ]);

  const bucketSize = eventSeries ? getBucketSize(series) : undefined;

  const [legendSelected, setLegendSelected] = useLocalStorageState(
    'issue-details-graph-legend',
    {
      ['Feature Flags']: true,
      ['Releases']: true,
    }
  );

  const legend = Legend({
    theme: theme,
    orient: 'horizontal',
    align: 'left',
    show: true,
    top: 4,
    right: 8,
    data: hasFeatureFlagFeature ? ['Feature Flags', 'Releases'] : ['Releases'],
    selected: legendSelected,
    zlevel: 10,
  });

  const onLegendSelectChanged = useMemo(
    () =>
      ({name, selected: record}) => {
        const newValue = record[name];
        setLegendSelected(prevState => ({
          ...prevState,
          [name]: newValue,
        }));
      },
    [setLegendSelected]
  );

  if (error) {
    return (
      <GraphAlert type="error" showIcon {...styleProps}>
        {tct('Graph Query Error: [message]', {message: error.message})}
      </GraphAlert>
    );
  }

  if (isLoadingStats || isPendingUniqueUsersCount) {
    return (
      <GraphWrapper {...styleProps}>
        <SummaryContainer>
          <GraphButton
            isActive={visibleSeries === EventGraphSeries.EVENT}
            disabled
            label={t('Events')}
          />
          <GraphButton
            isActive={visibleSeries === EventGraphSeries.USER}
            disabled
            label={t('Users')}
          />
        </SummaryContainer>
        <LoadingChartContainer>
          <Placeholder height="96px" testId="event-graph-loading" />
        </LoadingChartContainer>
      </GraphWrapper>
    );
  }

  return (
    <GraphWrapper {...styleProps}>
      <SummaryContainer>
        <GraphButton
          onClick={() =>
            visibleSeries === EventGraphSeries.USER &&
            setVisibleSeries(EventGraphSeries.EVENT)
          }
          isActive={visibleSeries === EventGraphSeries.EVENT}
          disabled={visibleSeries === EventGraphSeries.EVENT}
          label={tn('Event', 'Events', eventCount)}
          count={String(eventCount)}
        />
        <GraphButton
          onClick={() =>
            visibleSeries === EventGraphSeries.EVENT &&
            setVisibleSeries(EventGraphSeries.USER)
          }
          isActive={visibleSeries === EventGraphSeries.USER}
          disabled={visibleSeries === EventGraphSeries.USER}
          label={tn('User', 'Users', userCount)}
          count={String(userCount)}
        />
      </SummaryContainer>
      <ChartContainer role="figure">
        <BarChart
          height={100}
          series={series}
          legend={legend}
          onLegendSelectChanged={onLegendSelectChanged}
          showTimeInTooltip
          grid={{
            left: 8,
            right: 8,
            top: 20,
            bottom: 0,
          }}
          tooltip={{
            formatAxisLabel: (
              value,
              isTimestamp,
              utc,
              showTimeInTooltip,
              addSecondsToTimeFormat,
              _bucketSize,
              _seriesParamsOrParam
            ) =>
              String(
                defaultFormatAxisLabel(
                  value,
                  isTimestamp,
                  utc,
                  showTimeInTooltip,
                  addSecondsToTimeFormat,
                  bucketSize
                )
              ),
          }}
          yAxis={{
            splitNumber: 2,
            minInterval: 1,
            axisLabel: {
              formatter: (value: number) => {
                return formatAbbreviatedNumber(value);
              },
            },
          }}
          {...chartZoomProps}
        />
      </ChartContainer>
    </GraphWrapper>
  );
}

function GraphButton({
  isActive,
  label,
  count,
  ...props
}: {isActive: boolean; label: string; count?: string} & Partial<ButtonProps>) {
  return (
    <Callout
      isActive={isActive}
      aria-label={`${t('Toggle graph series')} - ${label}`}
      {...props}
    >
      <InteractionStateLayer hidden={isActive} />
      <Flex column>
        <Label isActive={isActive}>{label}</Label>
        <Count isActive={isActive}>{count ? formatAbbreviatedNumber(count) : '-'}</Count>
      </Flex>
    </Callout>
  );
}

const GraphWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
`;

const SummaryContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  flex-direction: column;
  margin: ${space(1)} ${space(1)} ${space(1)} 0;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;

const Callout = styled(Button)<{isActive: boolean}>`
  cursor: ${p => (p.isActive ? 'initial' : 'pointer')};
  border: 1px solid ${p => (p.isActive ? p.theme.purple100 : 'transparent')};
  background: ${p => (p.isActive ? p.theme.purple100 : 'transparent')};
  padding: ${space(0.5)} ${space(2)};
  box-shadow: none;
  height: unset;
  overflow: hidden;
  &:disabled {
    opacity: 1;
  }
  &:hover {
    border: 1px solid ${p => (p.isActive ? p.theme.purple100 : 'transparent')};
  }
`;

const Label = styled('div')<{isActive: boolean}>`
  line-height: 1;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => (p.isActive ? p.theme.purple400 : p.theme.subText)};
`;

const Count = styled('div')<{isActive: boolean}>`
  line-height: 1;
  margin-top: ${space(0.5)};
  font-size: 20px;
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => (p.isActive ? p.theme.purple400 : p.theme.textColor)};
`;

const ChartContainer = styled('div')`
  position: relative;
  padding: ${space(0.75)} ${space(1)} ${space(0.75)} 0;
`;

const LoadingChartContainer = styled('div')`
  position: relative;
  padding: ${space(1)} ${space(1)};
`;

const GraphAlert = styled(Alert)`
  padding-left: 24px;
  margin: 0 0 0 -24px;
  border: 0;
  border-radius: 0;
`;
