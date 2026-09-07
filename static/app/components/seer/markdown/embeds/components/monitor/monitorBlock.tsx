import type {ComponentType} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {CronMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/cron';
import {ErrorMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/error';
import {MetricMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/metric';
import {MobileBuildMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/mobileBuild';
import {UptimeMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/uptime';
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
import type {Organization} from 'sentry/types/organization';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

const MONITOR_TYPE_ICONS: Record<Detector['type'], ComponentType<SVGIconProps>> = {
  error: IconIssues,
  metric_issue: IconGraph,
  monitor_check_in_failure: IconClock,
  uptime_domain_failure: IconGlobe,
  preprod_size_analysis: IconMobile,
  issue_stream: IconTimer,
};

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
 * `unreachable` only guards this at compile time -- if the API ever returns a
 * detector type this union doesn't know about yet, the switch below would
 * otherwise fail silently. Report it once per type per page load.
 */
const reportedUnknownMonitorTypes = new Set<string>();

function reportUnknownMonitorType(type: string) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(`[Monitor] unknown detector type: ${type}`);
    return;
  }

  if (reportedUnknownMonitorTypes.has(type)) {
    return;
  }
  reportedUnknownMonitorTypes.add(type);

  Sentry.withScope(scope => {
    scope.setLevel('warning');
    scope.setTag('monitor.detector_type', type);
    scope.setFingerprint(['seer-monitor-unknown-detector-type', type]);
    Sentry.captureException(new Error(`[Monitor] unknown detector type: ${type}`));
  });
}

/**
 * Dispatches to the one component that knows how to preview this monitor type.
 * Adding a monitor type is a new file under `monitorTypes/`, plus a case here
 * and an icon above -- keep the type-specific rendering out of this file.
 */
function MonitorBlockContent({
  detector,
  organization,
}: {
  detector: Detector;
  organization: Organization;
}) {
  switch (detector.type) {
    case 'error':
      return <ErrorMonitor detector={detector} organization={organization} />;
    case 'metric_issue':
      return <MetricMonitor detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronMonitor detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeMonitor detector={detector} />;
    case 'preprod_size_analysis':
      return <MobileBuildMonitor detector={detector} />;
    case 'issue_stream':
      // Project monitors have no per-detector config to preview.
      return null;
    default: {
      const unhandled = unreachable(detector);
      reportUnknownMonitorType((unhandled as Detector).type);
      return <Text variant="danger">{t('Unsupported monitor type.')}</Text>;
    }
  }
}

export default function MonitorBlock({id, name}: EmbedOutput<'monitor'>) {
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
  const icon = detector ? (MONITOR_TYPE_ICONS[detector.type] ?? IconTimer) : IconTimer;

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
            <Flex gap="xs">
              <Tag variant="muted">{getDetectorTypeLabel(detector.type)}</Tag>
              {!detector.enabled && <Tag variant="muted">{t('Disabled')}</Tag>}
            </Flex>
          ) : null}
        </Flex>
        {isPending ? (
          <LoadingIndicator />
        ) : isError || !detector ? (
          <Text variant="danger">{t('Unable to load monitor details.')}</Text>
        ) : (
          <MonitorBlockContent detector={detector} organization={organization} />
        )}
      </Stack>
    </Container>
  );
}
