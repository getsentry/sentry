import {lazy} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {
  CronDetector,
  MetricDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {getNextCheckInEnv} from 'sentry/views/alerts/rules/crons/utils';
import {monitorCheckInsApiOptions} from 'sentry/views/insights/crons/utils/monitorCheckInsApiOptions';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';
import {uptimeChecksApiOptions} from 'sentry/views/insights/uptime/utils/uptimeChecksApiOptions';

const LazyMetricDetectorDetails = lazy(async () => {
  const {MetricDetectorDetailsDetect} =
    await import('sentry/views/detectors/components/details/metric/detect');
  return {default: MetricDetectorDetailsDetect};
});

const LazyMetricDetectorChart = lazy(async () => {
  const {MetricDetectorDetailsChart} =
    await import('sentry/views/detectors/components/details/metric/chart');
  return {default: MetricDetectorDetailsChart};
});

const LazyMonitorCheckInsGrid = lazy(async () => {
  const {MonitorCheckInsGrid} =
    await import('sentry/views/insights/crons/components/monitorCheckInsGrid');
  return {default: MonitorCheckInsGrid};
});

const LazyUptimeChecksGrid = lazy(async () => {
  const {UptimeChecksGrid} =
    await import('sentry/views/detectors/components/uptime/uptimeChecksGrid');
  return {default: UptimeChecksGrid};
});

const LazyDetectorDetailsOpenPeriodIssues = lazy(async () => {
  const {DetectorDetailsOpenPeriodIssues} =
    await import('sentry/views/detectors/components/details/common/openPeriodIssues');
  return {default: DetectorDetailsOpenPeriodIssues};
});

export type PreviewableDetector = MetricDetector | UptimeDetector | CronDetector;

function MetricDetectorPreview({detector}: {detector: MetricDetector}) {
  return (
    <Stack gap="md">
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Metric data')}
        </Heading>
        <ErrorBoundary mini>
          <LazyLoad LazyComponent={LazyMetricDetectorChart} detector={detector} />
        </ErrorBoundary>
      </Stack>
      <Stack.Separator />
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Rules')}
        </Heading>
        <LazyLoad LazyComponent={LazyMetricDetectorDetails} detector={detector} />
      </Stack>
    </Stack>
  );
}

function RecentUptimeCheckIns({
  detector,
  project,
}: {
  detector: UptimeDetector;
  project: Project;
}) {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery({
    ...uptimeChecksApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      detectorId: detector.id,
      limit: 3,
    }),
    retry: false,
  });

  if (isError) {
    return <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <LazyLoad
      LazyComponent={LazyUptimeChecksGrid}
      uptimeChecks={data}
      traceSampling={detector.dataSources[0].queryObj.traceSampling}
    />
  );
}

function UptimeDetectorPreview({detector}: {detector: UptimeDetector}) {
  const {queryObj} = detector.dataSources[0];
  const project = useProjectFromId({project_id: detector.projectId});
  const showRecentCheckIns = detector.latestGroup === null;

  return (
    <Stack gap="md">
      {showRecentCheckIns ? (
        <Stack gap="sm">
          <Heading as="h4" size="xs">
            {t('Recent check-ins')}
          </Heading>
          {project ? (
            <RecentUptimeCheckIns detector={detector} project={project} />
          ) : (
            <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>
          )}
        </Stack>
      ) : null}
      {showRecentCheckIns ? <Stack.Separator /> : null}
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Monitor configuration')}
        </Heading>
        <Text monospace wordBreak="break-all">
          {queryObj.method} {queryObj.url}
        </Text>
        <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
          <Text variant="muted">{t('Interval')}</Text>
          <Text>{t('Every %s', getDuration(queryObj.intervalSeconds))}</Text>
          <Text variant="muted">{t('Timeout')}</Text>
          <Text>{t('After %s', getDuration(queryObj.timeoutMs / 1000, 2))}</Text>
          <Text variant="muted">{t('Creates an issue')}</Text>
          <Text>
            {tn(
              'After one failed check',
              'After %s consecutive failed checks',
              detector.config.downtimeThreshold
            )}
          </Text>
          <Text variant="muted">{t('Resolves')}</Text>
          <Text>
            {tn(
              'After one successful check',
              'After %s consecutive successful checks',
              detector.config.recoveryThreshold
            )}
          </Text>
        </Grid>
      </Stack>
    </Stack>
  );
}

function RecentCronCheckIns({
  detector,
  project,
}: {
  detector: CronDetector;
  project: Project;
}) {
  const organization = useOrganization();
  const monitor = detector.dataSources[0].queryObj;
  const {data, isError, isPending} = useQuery({
    ...monitorCheckInsApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      monitorIdOrSlug: monitor.slug,
      limit: 3,
      expand: 'groups',
      environment: monitor.environments.map(item => item.name),
    }),
    retry: false,
  });

  if (isError) {
    return <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>;
  }

  return (
    <LazyLoad
      LazyComponent={LazyMonitorCheckInsGrid}
      checkIns={data ?? []}
      isLoading={isPending}
      hasMultiEnv={monitor.environments.length > 1}
      project={project}
    />
  );
}

function CronDetectorPreview({detector}: {detector: CronDetector}) {
  const monitor = detector.dataSources[0].queryObj;
  const environment = getNextCheckInEnv(monitor.environments);
  const project = useProjectFromId({project_id: detector.projectId});
  const showRecentCheckIns = detector.latestGroup === null;

  return (
    <Stack gap="md">
      {showRecentCheckIns ? (
        <Stack gap="sm">
          <Heading as="h4" size="xs">
            {t('Recent check-ins')}
          </Heading>
          {project ? (
            <ErrorBoundary mini>
              <RecentCronCheckIns detector={detector} project={project} />
            </ErrorBoundary>
          ) : (
            <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>
          )}
        </Stack>
      ) : null}
      {showRecentCheckIns ? <Stack.Separator /> : null}
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Monitor configuration')}
        </Heading>
        <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
          <Text variant="muted">{t('Schedule')}</Text>
          <Text>{scheduleAsText(monitor.config)}</Text>
          <Text variant="muted">{t('Monitor slug')}</Text>
          <Text monospace ellipsis>
            {monitor.slug}
          </Text>
          <Text variant="muted">{t('Last check-in')}</Text>
          <Text>
            {environment?.lastCheckIn ? (
              <TimeSince date={environment.lastCheckIn} />
            ) : (
              t('No check-ins')
            )}
          </Text>
          <Text variant="muted">{t('Next check-in')}</Text>
          <Text>
            {environment?.nextCheckIn ? (
              <TimeSince date={environment.nextCheckIn} />
            ) : (
              t('Not scheduled')
            )}
          </Text>
        </Grid>
      </Stack>
    </Stack>
  );
}

function DetectorTypePreview({detector}: {detector: PreviewableDetector}) {
  switch (detector.type) {
    case 'metric_issue':
      return <MetricDetectorPreview detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeDetectorPreview detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronDetectorPreview detector={detector} />;
    default:
      unreachable(detector);
      return null;
  }
}

export function DetectorPreview({detector}: {detector: PreviewableDetector}) {
  return (
    <Stack gap="md">
      {detector.latestGroup ? (
        <ErrorBoundary mini>
          <LazyLoad
            LazyComponent={LazyDetectorDetailsOpenPeriodIssues}
            detector={detector}
          />
        </ErrorBoundary>
      ) : null}
      {detector.latestGroup ? <Stack.Separator /> : null}
      <DetectorTypePreview detector={detector} />
    </Stack>
  );
}
