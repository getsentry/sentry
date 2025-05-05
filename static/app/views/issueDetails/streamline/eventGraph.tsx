import type React from 'react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs, useResizeObserver} from '@react-aria/utils';
import Color from 'color';

import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import Legend from 'sentry/components/charts/components/legend';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import Placeholder from 'sentry/components/placeholder';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import type EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {getBucketSize} from 'sentry/views/dashboards/utils/getBucketSize';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EVENT_GRAPH_WIDGET_ID} from 'sentry/views/issueDetails/streamline/eventGraphWidget';
import useFlagSeries from 'sentry/views/issueDetails/streamline/hooks/featureFlags/useFlagSeries';
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
   * Configures showing releases on the chart as bubbles or lines. This is used
   * when showing the chart inside of the flyout drawer. Bubbles are shown when
   * this prop is anything besides "line".
   */
  showReleasesAs?: 'line' | 'bubble';
  /**
   * Enable/disables showing the event and user summary
   */
  showSummary?: boolean;
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

  const hasReleaseBubblesSeries = organization.features.includes('release-bubbles-ui');

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

  const handleReleaseLineClick = useCallback(
    (release: ReleaseMetaBasic) => {
      navigate(makeReleaseDrawerPathname({location, release: release.version}));
    },
    [location, navigate]
  );

  const releaseSeries = useReleaseMarkLineSeries({
    group,
    releases: hasReleaseBubblesSeries && showReleasesAs !== 'line' ? [] : releases,
    onReleaseClick: handleReleaseLineClick,
  });

  // Do some manipulation to make sure the release buckets match up to `eventSeries`
  const lastEventSeries = eventSeries.at(-1);
  const penultEventSeries = eventSeries.at(-2);
  const lastEventSeriesTimestamp = lastEventSeries && (lastEventSeries.name as number);
  const penultEventSeriesTimestamp =
    penultEventSeries && (penultEventSeries.name as number);
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
    alignInMiddle: true,
    legendSelected: legendSelected.Releases,
    desiredBuckets: eventSeries.length,
    minTime: eventSeries.length && (eventSeries.at(0)?.name as number),
    maxTime:
      lastEventSeriesTimestamp && eventSeriesInterval
        ? lastEventSeriesTimestamp + eventSeriesInterval
        : undefined,
    releases: hasReleaseBubblesSeries && showReleasesAs !== 'line' ? releases : [],
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
    const translucentGray300 = Color(theme.gray300).alpha(0.5).string();
    const lightGray300 = Color(theme.gray300).alpha(0.2).string();

    if (visibleSeries === EventGraphSeries.USER) {
      if (isUnfilteredStatsEnabled) {
        seriesData.push({
          seriesName: t('Total users'),
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            borderColor: theme.translucentGray200,
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
          borderColor: theme.translucentGray200,
          color: theme.purple200,
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
            borderColor: theme.translucentGray200,
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
          borderColor: theme.translucentGray200,
          color: isUnfilteredStatsEnabled ? theme.purple200 : translucentGray300,
        },
        data: eventSeries,
        animation: false,
      });
    }

    // Only display the current event mark line if on the issue details tab
    if (currentEventSeries.markLine && currentTab === Tab.DETAILS) {
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
    inactiveColor: theme.gray200,
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
      <GraphAlert type="error" showIcon {...styleProps}>
        {tct('Graph Query Error: [message]', {message: error.message})}
      </GraphAlert>
    );
  }

  if (isLoadingStats || isPendingUniqueUsersCount) {
    return (
      <GraphWrapper {...styleProps}>
        {showSummary ? (
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
        ) : (
          <div />
        )}
        <LoadingChartContainer ref={chartContainerRef}>
          <Placeholder height="96px" testId="event-graph-loading" />
        </LoadingChartContainer>
      </GraphWrapper>
    );
  }

  return (
    <GraphWrapper {...styleProps}>
      {showSummary ? (
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
    </GraphWrapper>
  );
}

function GraphButton({
  isActive,
  label,
  count,
  ...props
}: {
  isActive: boolean;
  label: string;
  count?: string;
} & Partial<ButtonProps>) {
  return (
    <CalloutButton
      isActive={isActive}
      aria-label={`${t('Toggle graph series')} - ${label}`}
      {...props}
    >
      <Flex column>
        <Label isActive={isActive}>{label}</Label>
        <Count isActive={isActive}>{count ? formatAbbreviatedNumber(count) : '-'}</Count>
      </Flex>
    </CalloutButton>
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
  margin: ${space(1)} ${space(0.25)} ${space(1)} 0;
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    margin: ${space(1)} ${space(1)} ${space(1)} 0;
  }
`;

const CalloutButton = withChonk(
  styled(Button)<{isActive: boolean}>`
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
  `,
  styled(Button)<never>`
    height: unset;
    padding: ${space(0.5)} ${space(1.5)};
  `
);

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
  padding: ${space(0.75)} 0 ${space(0.75)} 0;
  margin-right: -2px;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    padding: ${space(0.75)} ${space(1)} ${space(0.75)} 0;
  }
`;

const LoadingChartContainer = styled('div')`
  position: relative;
  padding: ${space(0.75)} 0 ${space(0.75)} 0;
  margin: 0 ${space(1)};
`;

const GraphAlert = styled(Alert)`
  padding-left: 24px;
  margin: 0 0 0 -24px;
  border: 0;
  border-radius: 0;
`;
