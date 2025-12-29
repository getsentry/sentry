import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs, useResizeObserver} from '@react-aria/utils';
import Color from 'color';

import {Text} from '@sentry/scraps/text';

import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import Legend from 'sentry/components/charts/components/legend';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Alert} from 'sentry/components/core/alert';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import {Flex, Grid, type FlexProps} from 'sentry/components/core/layout';
import {useFlagSeries} from 'sentry/components/featureFlags/hooks/useFlagSeries';
import {useFlagsInEvent} from 'sentry/components/featureFlags/hooks/useFlagsInEvent';
import Placeholder from 'sentry/components/placeholder';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import type EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {getBucketSize} from 'sentry/views/dashboards/utils/getBucketSize';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EVENT_GRAPH_WIDGET_ID} from 'sentry/views/issueDetails/streamline/eventGraphWidget';
import {useCurrentEventMarklineSeries} from 'sentry/views/issueDetails/streamline/hooks/useEventMarkLineSeries';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useReleaseMarkLineSeries} from 'sentry/views/issueDetails/streamline/hooks/useReleaseMarkLineSeries';
import {Tab} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useReleasesDrawer} from 'sentry/views/releases/drawer/useReleasesDrawer';
import {useReleaseBubbles} from 'sentry/views/releases/releaseBubbles/useReleaseBubbles';
import {makeReleaseDrawerPathname} from 'sentry/views/releases/utils/pathnames';

enum EventGraphSeries {
  EVENT = 'event',
  USER = 'user',
}

interface EventGraphProps {
  event: Event | undefined;
  group: Group;
  /**
   * Configures showing releases on the chart as bubbles or lines. This is used
   * when showing the chart inside of the flyout drawer. Bubbles are shown when
   * this prop is anything besides "line".
   */
  showReleasesAs: 'line' | 'bubble';
  className?: string;
  /**
   * Disables navigation via router when the chart is zoomed. This is so the
   * release bubbles can zoom in on the chart when it renders and not trigger
   * navigation (which would update the page filters and affect the main
   * chart).
   */
  disableZoomNavigation?: boolean;
  eventView?: EventView;
  ref?: React.Ref<ReactEchartsRef>;
  /**
   * Enable/disables showing the event and user summary
   */
  showSummary?: boolean;
  style?: CSSProperties;
}

function createSeriesAndCount(stats: EventsStats) {
  return stats?.data?.reduce<{
    count: number;
    series: Array<{name: number; value: number}>;
  }>(
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
    {series: [], count: 0}
  );
}

export function EventGraph({
  group,
  event,
  eventView: eventViewProps,
  disableZoomNavigation = false,
  showReleasesAs,
  showSummary = true,
  ref,
  ...styleProps
}: EventGraphProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const navigate = useNavigate();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const [visibleSeries, setVisibleSeries] = useState<EventGraphSeries>(
    EventGraphSeries.EVENT
  );
  const config = getConfigForIssueType(group, group.project);
  const {dispatch} = useIssueDetails();
  const {currentTab} = useGroupDetailsRoute();
  const [isSmallContainer, setIsSmallContainer] = useState(false);

  const onResize = useCallback(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const {width} = chartContainerRef.current.getBoundingClientRect();
    setIsSmallContainer(width < 450);
  }, []);

  useResizeObserver({
    ref: chartContainerRef,
    onResize,
  });
  const eventViewHook = useIssueDetailsEventView({group, isSmallContainer});
  const eventView = eventViewProps || eventViewHook;

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

  const shouldShowBubbles = showReleasesAs !== 'line';

  const noQueryEventView = eventView.clone();
  noQueryEventView.query = `issue:${group.shortId}`;
  noQueryEventView.environment = [];

  const isUnfilteredStatsEnabled =
    eventView.query !== noQueryEventView.query || eventView.environment.length > 0;
  const {data: unfilteredGroupStats} =
    useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
      options: {
        enabled: isUnfilteredStatsEnabled,
      },
      params: {
        route: 'events-stats',
        eventView: noQueryEventView,
        referrer: 'issue_details.streamline_graph',
      },
    });

  const {data: uniqueUsersCount, isPending: isPendingUniqueUsersCount} = useApiQuery<{
    data: Array<{'count_unique(user)': number}>;
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

  // Ensure the dropdown can access the new filtered event count
  useEffect(() => {
    dispatch({type: 'UPDATE_EVENT_COUNT', count: eventCount});
  }, [eventCount, dispatch]);

  const {series: unfilteredEventSeries} = useMemo(() => {
    if (!unfilteredGroupStats?.['count()']) {
      return {series: []};
    }

    return createSeriesAndCount(unfilteredGroupStats['count()']);
  }, [unfilteredGroupStats]);
  const {series: unfilteredUserSeries} = useMemo(() => {
    if (!unfilteredGroupStats?.['count_unique(user)']) {
      return {series: []};
    }
    return createSeriesAndCount(unfilteredGroupStats['count_unique(user)']);
  }, [unfilteredGroupStats]);
  const userSeries = useMemo(() => {
    if (!groupStats['count_unique(user)']) {
      return [];
    }

    return createSeriesAndCount(groupStats['count_unique(user)']).series;
  }, [groupStats]);

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  const currentEventSeries = useCurrentEventMarklineSeries({
    event,
    group,
    eventSeries,
  });

  const [legendSelected, setLegendSelected] = useLocalStorageState(
    'issue-details-graph-legend',
    {
      ['Feature Flags']: true,
      ['Releases']: false,
    }
  );

  const {releases = []} = useReleaseStats(
    {
      projects: eventView.project,
      environments: eventView.environment,
      datetime: {
        start: eventView.start,
        end: eventView.end,
        period: eventView.statsPeriod,
      },
    },
    {
      staleTime: 0,
    }
  );
  const {flags} = useFlagsInEvent({
    eventId: event?.id,
    groupId: group.id,
    group,
    event,
    query: {
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
    },
    enabled: Boolean(event?.id && group.id),
  });

  const handleReleaseLineClick = useCallback(
    (release: ReleaseMetaBasic) => {
      navigate(
        makeReleaseDrawerPathname({
          location,
          release: release.version,
          source: 'issue-details',
        })
      );
    },
    [location, navigate]
  );

  const releaseSeries = useReleaseMarkLineSeries({
    group,
    releases: shouldShowBubbles ? [] : releases,
    onReleaseClick: handleReleaseLineClick,
  });

  // always show flag lines regardless of release line/bubble display
  const flagSeries = useFlagSeries({
    event,
    flags,
  });

  // Do some manipulation to make sure the release buckets match up to `eventSeries`
  const lastEventSeries = eventSeries.at(-1);
  const penultEventSeries = eventSeries.at(-2);
  const lastEventSeriesTimestamp = lastEventSeries?.name;
  const penultEventSeriesTimestamp = penultEventSeries?.name;
  const eventSeriesInterval =
    lastEventSeriesTimestamp &&
    penultEventSeriesTimestamp &&
    lastEventSeriesTimestamp - penultEventSeriesTimestamp;

  const {
    connectReleaseBubbleChartRef,
    releaseBubbleSeries,
    releaseBubbleXAxis,
    releaseBubbleGrid,
  } = useReleaseBubbles({
    chartId: EVENT_GRAPH_WIDGET_ID,
    eventId: event?.id,
    alignInMiddle: true,
    legendSelected: legendSelected.Releases,
    desiredBuckets: eventSeries.length,
    minTime: eventSeries.length && (eventSeries.at(0)?.name as number),
    maxTime:
      lastEventSeriesTimestamp && eventSeriesInterval
        ? lastEventSeriesTimestamp + eventSeriesInterval
        : undefined,
    releases: shouldShowBubbles ? releases : [],
    flags: shouldShowBubbles ? flags : [],
    projects: eventView.project,
    environments: eventView.environment,
    datetime: {
      start: eventView.start,
      end: eventView.end,
      period: eventView.statsPeriod,
    },
  });

  useReleasesDrawer();

  const handleConnectRef = useCallback(
    (e: ReactEchartsRef | null) => {
      connectReleaseBubbleChartRef(e);
    },
    [connectReleaseBubbleChartRef]
  );

  const series = useMemo((): BarChartSeries[] => {
    const seriesData: BarChartSeries[] = [];
    const translucentGray300 = Color(theme.colors.gray400).alpha(0.5).string();
    const lightGray300 = Color(theme.colors.gray400).alpha(0.2).string();

    if (visibleSeries === EventGraphSeries.USER) {
      if (isUnfilteredStatsEnabled) {
        seriesData.push({
          seriesName: t('Total users'),
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            borderColor: theme.colors.gray200,
            color: lightGray300,
          },
          barGap: '-100%', // Makes bars overlap completely
          data: unfilteredUserSeries,
          animation: false,
        });
      }

      seriesData.push({
        seriesName: isUnfilteredStatsEnabled ? t('Matching users') : t('Users'),
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          borderColor: theme.colors.gray200,
          color: isUnfilteredStatsEnabled ? theme.colors.blue400 : translucentGray300,
        },
        data: userSeries,
        animation: false,
      });
    }
    if (visibleSeries === EventGraphSeries.EVENT) {
      if (isUnfilteredStatsEnabled) {
        seriesData.push({
          seriesName: t('Total events'),
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            borderColor: theme.colors.gray200,
            color: lightGray300,
          },
          barGap: '-100%', // Makes bars overlap completely
          data: unfilteredEventSeries,
          animation: false,
        });
      }

      seriesData.push({
        seriesName: isUnfilteredStatsEnabled ? t('Matching events') : t('Events'),
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          borderColor: theme.colors.gray200,
          color: isUnfilteredStatsEnabled ? theme.colors.blue400 : translucentGray300,
        },
        data: eventSeries,
        animation: false,
      });
    }

    // Only display the current event mark line if on the issue details tab
    if (currentEventSeries?.markLine && currentTab === Tab.DETAILS) {
      seriesData.push(currentEventSeries as BarChartSeries);
    }

    if (releaseSeries?.markLine) {
      seriesData.push(releaseSeries as BarChartSeries);
    }

    if (flagSeries.markLine && flagSeries.type === 'line') {
      seriesData.push(flagSeries as BarChartSeries);
    }

    return seriesData;
  }, [
    visibleSeries,
    userSeries,
    eventSeries,
    currentEventSeries,
    releaseSeries,
    flagSeries,
    theme,
    isUnfilteredStatsEnabled,
    unfilteredEventSeries,
    unfilteredUserSeries,
    currentTab,
  ]);

  const bucketSize = eventSeries ? getBucketSize(series) : undefined;

  const legend = Legend({
    theme,
    orient: 'horizontal',
    align: 'left',
    show: true,
    top: 4,
    right: 8,
    data: flagSeries.type === 'line' ? ['Feature Flags', 'Releases'] : ['Releases'],
    selected: legendSelected,
    zlevel: 10,
    inactiveColor: theme.tokens.content.muted,
  });

  const onLegendSelectChanged = useMemo(
    () =>
      ({name, selected: record}: any) => {
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
      <GraphAlert type="error" {...styleProps}>
        {tct('Graph Query Error: [message]', {message: error.message})}
      </GraphAlert>
    );
  }

  if (isLoadingStats || isPendingUniqueUsersCount) {
    return (
      <Grid columns="auto 1fr" {...styleProps}>
        {showSummary ? (
          <SummaryContainer>
            <GraphButton disabled label={t('Events')} />
            <GraphButton disabled label={t('Users')} />
          </SummaryContainer>
        ) : (
          <div />
        )}
        <Flex ref={chartContainerRef} justify="center" align="center" margin="0 md 0 xs">
          <Placeholder height="90px" testId="event-graph-loading" />
        </Flex>
      </Grid>
    );
  }

  return (
    <Grid columns="auto 1fr" {...styleProps}>
      {showSummary ? (
        <SummaryContainer>
          <GraphButton
            onClick={() => setVisibleSeries(EventGraphSeries.EVENT)}
            disabled={visibleSeries === EventGraphSeries.EVENT}
            label={tn('Event', 'Events', eventCount)}
            count={String(eventCount)}
          />
          <GraphButton
            onClick={() => setVisibleSeries(EventGraphSeries.USER)}
            disabled={visibleSeries === EventGraphSeries.USER}
            label={tn('User', 'Users', userCount)}
            count={String(userCount)}
          />
        </SummaryContainer>
      ) : (
        <div />
      )}
      <ChartContainer role="figure" ref={chartContainerRef}>
        <BarChart
          ref={mergeRefs(ref, handleConnectRef)}
          height={100}
          series={series}
          additionalSeries={releaseBubbleSeries ? [releaseBubbleSeries] : []}
          legend={legend}
          onLegendSelectChanged={onLegendSelectChanged}
          showTimeInTooltip
          grid={{
            left: 8,
            right: 8,
            top: 20,
            bottom: 0,
            ...releaseBubbleGrid,
          }}
          tooltip={{
            appendToBody: true,
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
          xAxis={{
            axisTick: {
              show: false,
            },
            axisLabel: {
              margin: 8,
            },
            ...releaseBubbleXAxis,
          }}
          {...(disableZoomNavigation
            ? {
                isGroupedByDate: true,
                dataZoom: chartZoomProps.dataZoom,
              }
            : chartZoomProps)}
        />
      </ChartContainer>
    </Grid>
  );
}

function GraphButton({
  label,
  count,
  ...props
}: {
  label: string;
  count?: string;
} & Partial<ButtonProps>) {
  const textVariant = undefined;

  return (
    <CalloutButton aria-label={`${t('Toggle graph series')} - ${label}`} {...props}>
      <Flex direction="column" gap="xs">
        <Text size="sm" variant={textVariant}>
          {label}
        </Text>
        <Text size="lg" variant={textVariant}>
          {count ? formatAbbreviatedNumber(count) : '-'}
        </Text>
      </Flex>
    </CalloutButton>
  );
}

function SummaryContainer(props: FlexProps) {
  return (
    <Flex padding="lg xs lg lg" direction="column" gap="sm" radius="md" {...props} />
  );
}

const CalloutButton = styled(Button)`
  height: unset;
  padding: ${space(0.5)} ${space(1.5)};
`;

const ChartContainer = styled('div')`
  position: relative;
  padding: ${p => p.theme.space.sm} 0 ${p => p.theme.space.sm} 0;
  margin-right: -2px;

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    padding: ${p => p.theme.space.sm} ${p => p.theme.space.md} ${p => p.theme.space.sm} 0;
  }
`;

export const GraphAlert = styled(Alert)`
  padding-left: ${p => p.theme.space['2xl']};
  margin: 0 0 0 -${p => p.theme.space['2xl']};
  border: 0;
  border-radius: 0;
`;
