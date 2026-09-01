import {lazy, type ComponentType} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {CronMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/cron';
import {ErrorMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/error';
import {MetricMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/metric';
import {MobileBuildMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/mobileBuild';
import {ProjectMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/projectMonitor';
import {UptimeMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/variants/uptime';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {
  IconClock,
  IconGlobe,
  IconGraph,
  IconIssues,
  IconMobile,
  IconTimer,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

const LazyDetectorDetailsOpenPeriodIssues = lazy(async () => {
  const {DetectorDetailsOpenPeriodIssues} =
    await import('sentry/views/detectors/components/details/common/openPeriodIssues');
  return {default: DetectorDetailsOpenPeriodIssues};
});

const MONITOR_TYPE_ICONS: Record<Detector['type'], ComponentType<SVGIconProps>> = {
  error: IconIssues,
  metric_issue: IconGraph,
  monitor_check_in_failure: IconClock,
  uptime_domain_failure: IconGlobe,
  preprod_size_analysis: IconMobile,
  issue_stream: IconTimer,
};

/**
 * Error and project monitors already lead with the issues they group, so the
 * shared ongoing-issue section would only repeat them.
 */
const TYPES_WITHOUT_ONGOING_ISSUES: ReadonlySet<Detector['type']> = new Set([
  'error',
  'issue_stream',
]);

function monitorDetailsApiOptions(organizationSlug: string, detectorId: string) {
  return apiOptions.as<Detector>()(
    '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
    {
      path: {organizationIdOrSlug: organizationSlug, detectorId},
      staleTime: 30_000,
    }
  );
}

/**
 * Dispatches to the one variant that knows how to preview this monitor type.
 * Adding a monitor type is a new file under `variants/` plus a case here and an
 * icon above -- keep the type-specific rendering out of this file.
 */
function MonitorVariant({
  detector,
  hasOngoingIssue,
  statsPeriod,
}: {
  detector: Detector;
  hasOngoingIssue: boolean;
  statsPeriod?: string;
}) {
  switch (detector.type) {
    case 'error':
      return <ErrorMonitor id={detector.id} statsPeriod={statsPeriod} />;
    case 'metric_issue':
      return <MetricMonitor detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronMonitor detector={detector} hasOngoingIssue={hasOngoingIssue} />;
    case 'uptime_domain_failure':
      return <UptimeMonitor detector={detector} hasOngoingIssue={hasOngoingIssue} />;
    case 'preprod_size_analysis':
      return <MobileBuildMonitor detector={detector} />;
    case 'issue_stream':
      return <ProjectMonitor />;
    default:
      unreachable(detector);
      return null;
  }
}

function MonitorBlockContent({
  detector,
  statsPeriod,
}: {
  detector: Detector;
  statsPeriod?: string;
}) {
  const hasOngoingIssue =
    Boolean(detector.latestGroup) && !TYPES_WITHOUT_ONGOING_ISSUES.has(detector.type);

  if (!hasOngoingIssue) {
    return (
      <MonitorVariant
        detector={detector}
        hasOngoingIssue={hasOngoingIssue}
        statsPeriod={statsPeriod}
      />
    );
  }

  return (
    <Stack gap="md">
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={LazyDetectorDetailsOpenPeriodIssues}
          detector={detector}
        />
      </ErrorBoundary>
      <Stack.Separator />
      <MonitorVariant
        detector={detector}
        hasOngoingIssue={hasOngoingIssue}
        statsPeriod={statsPeriod}
      />
    </Stack>
  );
}

export default function MonitorBlock({id, name, statsPeriod}: EmbedOutput<'monitor'>) {
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
  const icon = detector ? MONITOR_TYPE_ICONS[detector.type] : IconTimer;

  return (
    <Container background="primary" border="primary" radius="md" padding="md">
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
