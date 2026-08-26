import {lazy, type ComponentType} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconClock,
  IconGlobe,
  IconGraph,
  IconIssues,
  IconMobile,
  IconTimer,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tn} from 'sentry/locale';
import type {
  CronDetector,
  Detector,
  MetricDetector,
  PreprodDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {getNextCheckInEnv} from 'sentry/views/alerts/rules/crons/utils';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

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

const LazyMobileBuildDetectorDetails = lazy(async () => {
  const {MobileBuildDetectorDetailsDetect} =
    await import('sentry/views/detectors/components/details/mobileBuild/detect');
  return {default: MobileBuildDetectorDetailsDetect};
});

const LazyMonitorCheckIns = lazy(async () => {
  const {MonitorCheckIns} =
    await import('sentry/views/insights/crons/components/monitorCheckIns');
  return {default: MonitorCheckIns};
});

const LazyDetectorDetailsOpenPeriodIssues = lazy(async () => {
  const {DetectorDetailsOpenPeriodIssues} =
    await import('sentry/views/detectors/components/details/common/openPeriodIssues');
  return {default: DetectorDetailsOpenPeriodIssues};
});

function monitorDetailsApiOptions(organizationSlug: string, detectorId: string) {
  return apiOptions.as<Detector>()(
    '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
    {
      path: {organizationIdOrSlug: organizationSlug, detectorId},
      staleTime: 30_000,
    }
  );
}

function getMonitorIcon(type: Detector['type']): ComponentType<SVGIconProps> {
  switch (type) {
    case 'error':
      return IconIssues;
    case 'metric_issue':
      return IconGraph;
    case 'monitor_check_in_failure':
      return IconClock;
    case 'uptime_domain_failure':
      return IconGlobe;
    case 'preprod_size_analysis':
      return IconMobile;
    case 'issue_stream':
      return IconTimer;
    default:
      unreachable(type);
      return IconTimer;
  }
}

function ErrorMonitorBlock({id, statsPeriod}: {id: string; statsPeriod?: string}) {
  return (
    <ErrorBoundary mini>
      <LazyLoad
        LazyComponent={LazyGroupList}
        queryParams={{
          query: `is:unresolved detector:${id}`,
          statsPeriod: statsPeriod ?? '24h',
          limit: 5,
        }}
        numPlaceholderRows={3}
        withChart={false}
        withColumns={[]}
        withHeader={false}
        withPagination={false}
        canSelectGroups={false}
        useFilteredStats={false}
      />
    </ErrorBoundary>
  );
}

function MetricMonitorBlock({detector}: {detector: MetricDetector}) {
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

function UptimeMonitorBlock({detector}: {detector: UptimeDetector}) {
  const {queryObj} = detector.dataSources[0];

  return (
    <Stack gap="md">
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
  );
}

function CronMonitorBlock({detector}: {detector: CronDetector}) {
  const monitor = detector.dataSources[0].queryObj;
  const environment = getNextCheckInEnv(monitor.environments);
  const project = useProjectFromId({project_id: detector.projectId});

  return (
    <Stack gap="md">
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Recent check-ins')}
        </Heading>
        {project ? (
          <Container overflowX="auto">
            <ErrorBoundary mini>
              <LazyLoad
                LazyComponent={LazyMonitorCheckIns}
                monitorSlug={monitor.slug}
                monitorEnvs={monitor.environments}
                project={project}
              />
            </ErrorBoundary>
          </Container>
        ) : (
          <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>
        )}
      </Stack>
      <Stack.Separator />
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

function MobileBuildMonitorBlock({detector}: {detector: PreprodDetector}) {
  return (
    <Stack gap="md">
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={LazyDetectorDetailsOpenPeriodIssues}
          detector={detector}
        />
      </ErrorBoundary>
      <Stack.Separator />
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Rules')}
        </Heading>
        <LazyLoad LazyComponent={LazyMobileBuildDetectorDetails} detector={detector} />
      </Stack>
    </Stack>
  );
}

function MonitorBlockContent({
  detector,
  statsPeriod,
}: {
  detector: Detector;
  statsPeriod?: string;
}) {
  switch (detector.type) {
    case 'error':
      return <ErrorMonitorBlock id={detector.id} statsPeriod={statsPeriod} />;
    case 'metric_issue':
      return <MetricMonitorBlock detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronMonitorBlock detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeMonitorBlock detector={detector} />;
    case 'preprod_size_analysis':
      return <MobileBuildMonitorBlock detector={detector} />;
    case 'issue_stream':
      return (
        <Text variant="muted">
          {t('Project monitors do not support block previews.')}
        </Text>
      );
    default:
      unreachable(detector);
      return null;
  }
}

function MonitorLink({id, name}: EmbedOutput<'monitor'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);

  return (
    <ResourceLink icon={IconTimer} href={href} title={name ?? t('Monitor %s', id)} />
  );
}

function MonitorBlock({id, name, statsPeriod}: EmbedOutput<'monitor'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);
  const {
    data: detector,
    isError,
    isPending,
  } = useQuery({
    ...monitorDetailsApiOptions(organization.slug, id),
    retry: false,
  });
  const icon = detector ? getMonitorIcon(detector.type) : IconTimer;

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      padding="md"
      overflow="hidden"
    >
      <Stack gap="md">
        <Flex align="center" justify="between" gap="md" wrap="wrap">
          <ResourceLink
            icon={icon}
            href={href}
            title={detector?.name ?? name ?? t('Monitor %s', id)}
          />
          {detector ? (
            <Tag variant={detector.enabled ? 'success' : 'muted'}>
              {getDetectorTypeLabel(detector.type)}
            </Tag>
          ) : null}
        </Flex>
        {isPending ? (
          <LoadingIndicator />
        ) : isError || !detector ? (
          <Text variant="muted">{t('Unable to load monitor details.')}</Text>
        ) : (
          <MonitorBlockContent detector={detector} statsPeriod={statsPeriod} />
        )}
      </Stack>
    </Container>
  );
}

export const Monitor = defineSeerEmbed({
  name: 'monitor',
  render(props, level) {
    if (level === 'block') {
      return <MonitorBlock {...props} />;
    }
    return <MonitorLink {...props} />;
  },
});
