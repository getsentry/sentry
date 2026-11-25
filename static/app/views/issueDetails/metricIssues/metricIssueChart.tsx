import {useCallback, useEffect} from 'react';

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
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {limitDateTimeParamsToMaxPoints} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
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
  const {eventId} = useParams<{eventId?: string}>();
  const location = useLocation();
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, group.project);
  const {statsPeriod, start, end} = location.query;
  const period = normalizeDateTimeParams(
    statsPeriod || start || end
      ? getPeriod({
          start: start as string,
          end: end as string,
          period: statsPeriod as string,
        })
      : defaultStatsPeriod
  );
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
  const {data: openPeriodCount} = useOpenPeriodCount({
    groupId: group.id,
    start: period.start,
    end: period.end,
    statsPeriod: period.statsPeriod,
  });
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

  if (isDetectorPending) {
    return <MetricIssueChartPlaceholder />;
  }

  return (
    <MetricIssueChartContent
      detector={detector}
      group={group}
      event={event}
      period={period}
      isOverview={!eventId}
    />
  );
}

function MetricIssueChartContent({
  detector,
  group,
  event,
  period,
  isOverview,
}: {
  detector: MetricDetector;
  event: Event | undefined;
  group: Group;
  isOverview: boolean;
  period: ReturnType<typeof normalizeDateTimeParams>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  // Wait for the event's open period because we will zoom into it on the chart
  const {data: openPeriod, isLoading: isOpenPeriodLoading} = useEventOpenPeriod({
    groupId: group.id,
    eventId: isOverview ? undefined : event?.id,
  });
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
    enabled: !isOpenPeriodLoading,
    ...cappedDateTimeParams,
  });

  if (isOpenPeriodLoading || isLoading) {
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
