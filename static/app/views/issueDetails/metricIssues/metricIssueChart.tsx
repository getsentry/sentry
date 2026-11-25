import {useCallback, useEffect, useEffectEvent, useMemo} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, GroupOpenPeriod} from 'sentry/types/group';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils/defined';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {decodeScalar} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  buildDetectorZoomQuery,
  getOpenPeriodZoomRange,
  limitDateTimeParamsToMaxPoints,
  type ZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
import {useMetricDetectorChart} from 'sentry/views/detectors/components/details/metric/chart';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {
  useEventOpenPeriod,
  useOpenPeriodCount,
  useOpenPeriods,
} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {getOpenPeriodIssuePath} from 'sentry/views/detectors/utils/getOpenPeriodIssuePath';
import {useIssueDetails} from 'sentry/views/issueDetails/context';
import {useGroupDefaultStatsPeriod} from 'sentry/views/issueDetails/useGroupDefaultStatsPeriod';
import {RESERVED_EVENT_IDS} from 'sentry/views/issueDetails/useGroupEvent';

interface MetricIssueChartProps {
  event: Event | undefined;
  group: Group;
}

const CHART_HEIGHT = 180;

function getDetectorErrorMessage(detectorError: Error): string {
  if (detectorError instanceof RequestError && detectorError.status === 404) {
    return t('The metric monitor which created this issue no longer exists.');
  }
  if (detectorError instanceof RequestError && detectorError.responseJSON?.detail) {
    return t(
      'The metric monitor could not be loaded: %s',
      detectorError.responseJSON.detail
    );
  }
  return t('The metric monitor could not be loaded.');
}

export function MetricIssueChart({group, event}: MetricIssueChartProps) {
  const {eventId: routeEventId} = useParams<{eventId?: string}>();
  const isOverview = !routeEventId;
  const location = useLocation();
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, group.project);
  const urlStatsPeriod = decodeScalar(location.query.statsPeriod);
  const urlStart = decodeScalar(location.query.start);
  const urlEnd = decodeScalar(location.query.end);
  const hasUrlRange = !!(urlStatsPeriod || urlStart || urlEnd);
  // On event routes, wait for the event so the chart can highlight and zoom to its open period
  const isWaitingForEvent = !isOverview && !event;
  const {data: openPeriod, isLoading: isOpenPeriodLoading} = useEventOpenPeriod({
    groupId: group.id,
    eventId: isOverview ? undefined : event?.id,
  });
  const isEventRoute =
    !!routeEventId &&
    !!event &&
    (routeEventId === event.id || RESERVED_EVENT_IDS.has(routeEventId));
  const zoomRange = useZoomToEventOpenPeriod({
    event,
    groupId: group.id,
    openPeriod,
    enabled: isEventRoute && !hasUrlRange && !isOpenPeriodLoading,
  });
  // Read the zoom range like a URL range, so the request params match once the URL updates
  const zoomQuery = zoomRange ? buildDetectorZoomQuery({}, zoomRange) : null;
  const urlRange =
    zoomQuery ??
    (hasUrlRange ? {start: urlStart, end: urlEnd, statsPeriod: urlStatsPeriod} : null);
  const period = normalizeDateTimeParams(
    urlRange
      ? getPeriod({
          start: urlRange.start,
          end: urlRange.end,
          period: urlRange.statsPeriod,
        })
      : defaultStatsPeriod
  );
  const isPeriodReady = !isWaitingForEvent && !isOpenPeriodLoading;

  const {dispatch, detectorDetails} = useIssueDetails();
  const detectorId = detectorDetails?.detectorId;
  const {
    data: detector,
    isPending: isDetectorPending,
    isError: isDetectorError,
    error: detectorError,
  } = useDetectorQuery<MetricDetector>(detectorId ?? '', {
    enabled: !!detectorId && detectorDetails?.detectorType === 'metric_alert',
    retry: false,
  });
  const {data: openPeriodCount} = useOpenPeriodCount(
    {
      groupId: group.id,
      start: period.start,
      end: period.end,
      statsPeriod: period.statsPeriod,
    },
    {enabled: isPeriodReady}
  );
  useEffect(() => {
    if (defined(openPeriodCount)) {
      dispatch({type: 'UPDATE_EVENT_COUNT', count: openPeriodCount});
    }
  }, [openPeriodCount, dispatch]);

  if (isDetectorError) {
    return (
      <Container width="100%">
        <Alert variant="danger">{getDetectorErrorMessage(detectorError)}</Alert>
      </Container>
    );
  }

  if (isDetectorPending || !isPeriodReady) {
    return <MetricIssueChartPlaceholder />;
  }

  return (
    <MetricIssueChartContent
      detector={detector}
      group={group}
      openPeriod={openPeriod}
      period={period}
    />
  );
}

/**
 * On an event route with no time range in the URL, zoom the chart to the event's open period.
 * Returns the zoom range so the chart can use it before the URL updates.
 */
function useZoomToEventOpenPeriod({
  event,
  groupId,
  openPeriod,
  enabled,
}: {
  enabled: boolean;
  event: Event | undefined;
  groupId: string;
  openPeriod: GroupOpenPeriod | null | undefined;
}): ZoomRangeMs | null {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  // The detector's time window when the issue triggered
  const timeWindow: number | undefined =
    event?.occurrence?.evidenceData?.dataSources?.[0]?.queryObj?.snubaQuery?.timeWindow;
  const openPeriodStart = openPeriod?.start ?? event?.dateCreated;
  const openPeriodEnd = openPeriod?.end ?? null;
  const eventId = event?.id;

  // Computed once per open period so near-now ranges stay stable across renders
  const zoomRange = useMemo(
    () =>
      enabled && openPeriodStart && timeWindow
        ? getOpenPeriodZoomRange({openPeriodStart, openPeriodEnd, timeWindow})
        : null,
    [enabled, openPeriodStart, openPeriodEnd, timeWindow]
  );

  const applyZoomRange = useEffectEvent((range: ZoomRangeMs) => {
    navigate(
      {
        pathname: normalizeUrl(
          `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/`
        ),
        query: buildDetectorZoomQuery(location.query, range),
      },
      {replace: true}
    );
  });

  useEffect(() => {
    if (zoomRange) {
      applyZoomRange(zoomRange);
    }
  }, [zoomRange]);

  return zoomRange;
}

function MetricIssueChartContent({
  detector,
  group,
  openPeriod,
  period,
}: {
  detector: MetricDetector;
  group: Group;
  openPeriod: GroupOpenPeriod | null | undefined;
  period: ReturnType<typeof normalizeDateTimeParams>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const intervalSeconds = detector.dataSources[0]?.queryObj?.snubaQuery?.timeWindow;
  const {dateTimeParams: cappedDateTimeParams, isRangeLimited} =
    limitDateTimeParamsToMaxPoints({...period, intervalSeconds});

  const {data: openPeriods = []} = useOpenPeriods({
    groupId: group.id,
    ...cappedDateTimeParams,
  });

  const navigateToOpenPeriodIssue = useCallback(
    (clickedOpenPeriod: GroupOpenPeriod) =>
      navigate({
        pathname: getOpenPeriodIssuePath(clickedOpenPeriod, organization.slug),
        query: location.query,
      }),
    [navigate, organization.slug, location.query]
  );

  const {
    chartProps,
    isLoading,
    error: chartError,
  } = useMetricDetectorChart({
    detector,
    openPeriods,
    highlightedOpenPeriodId: openPeriod?.id,
    onOpenPeriodClick: navigateToOpenPeriodIssue,
    height: CHART_HEIGHT,
    ...cappedDateTimeParams,
  });

  if (isLoading) {
    return <MetricIssueChartPlaceholder />;
  }

  if (chartError) {
    return (
      <Container width="100%">
        <Alert variant="danger">
          {t('Error loading metric monitor: %s', chartError?.message)}
        </Alert>
      </Container>
    );
  }

  return (
    <MetricChartSection>
      <Stack paddingTop="md">
        {isRangeLimited ? (
          <Alert variant="warning">
            {t(
              'The selected time range contains too many data points. Narrow the range to view all data.'
            )}
          </Alert>
        ) : null}
        <AreaChart {...chartProps} />
      </Stack>
    </MetricChartSection>
  );
}

function MetricIssueChartPlaceholder() {
  return (
    <MetricChartSection>
      <Flex align="center" justify="center" padding="md 0" height={`${CHART_HEIGHT}px`}>
        <Placeholder height="100%" />
      </Flex>
    </MetricChartSection>
  );
}

function MetricChartSection({children}: {children: React.ReactNode}) {
  return (
    <Container width="100%" padding="0 lg sm lg">
      {children}
    </Container>
  );
}
