import type {ComponentType} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  canResolveDetectorId,
  getAlertDetailsPathname,
  getEmbeddedDetectorId,
} from 'sentry/components/seer/markdown/embeds/components/alert/alertUtils';
import {CronMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/cron';
import {MetricMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/metric';
import {UptimeMonitor} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorTypes/uptime';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconClock, IconGlobe, IconGraph, IconSiren} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {
  CronDetector,
  Detector,
  MetricDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationActionSummary} from 'sentry/views/automations/components/automationActionSummary';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

type DetectorAlertKind = Exclude<EmbedOutput<'alert'>['kind'], 'issue'>;

type PreviewableDetector = MetricDetector | UptimeDetector | CronDetector;

function detectorAlertApiOptions(
  organizationSlug: string,
  detectorId: string | undefined
) {
  return apiOptions.as<Detector>()(
    '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
    {
      path: detectorId ? {organizationIdOrSlug: organizationSlug, detectorId} : skipToken,
      staleTime: 30_000,
    }
  );
}

interface AlertRuleDetectorResponse {
  detectorId: string;
}

/**
 * The detector behind this alert, translating a legacy metric alert's
 * `AlertRule` id when that is all the embed carries. The workflow engine keeps
 * an explicit lookup table between the two id spaces, which is the same
 * translation the alert routes perform when redirecting onto the monitor page.
 *
 * A 404 from that lookup means the alert was never dual-written, so there is
 * no detector to preview -- it resolves to nothing rather than to an error.
 */
function useResolvedDetectorId(alert: EmbedOutput<'alert'>) {
  const organization = useOrganization();
  const shouldResolve = canResolveDetectorId(alert);

  const {data, isPending} = useQuery({
    ...apiOptions.as<AlertRuleDetectorResponse>()(
      '/organizations/$organizationIdOrSlug/alert-rule-detector/',
      {
        path: shouldResolve ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {alert_rule_id: alert.id},
        staleTime: 30_000,
      }
    ),
    retry: false,
  });

  if (!shouldResolve) {
    return {detectorId: getEmbeddedDetectorId(alert), isResolving: false};
  }

  return {detectorId: data?.detectorId, isResolving: isPending};
}

function getDetectorAlertLabel(kind: DetectorAlertKind) {
  switch (kind) {
    case 'metric':
      return t('Metric alert');
    case 'uptime':
      return t('Uptime alert');
    case 'cron':
      return t('Cron alert');
    default:
      unreachable(kind);
      return t('Alert');
  }
}

function getDetectorAlertIcon(kind: DetectorAlertKind): ComponentType<SVGIconProps> {
  switch (kind) {
    case 'metric':
      return IconGraph;
    case 'uptime':
      return IconGlobe;
    case 'cron':
      return IconClock;
    default:
      unreachable(kind);
      return IconGraph;
  }
}

function isAlertDetector(detector: Detector): detector is PreviewableDetector {
  return (
    detector.type === 'metric_issue' ||
    detector.type === 'uptime_domain_failure' ||
    detector.type === 'monitor_check_in_failure'
  );
}

function DetectorAlertActions({detectorId}: {detectorId: string}) {
  const organization = useOrganization();
  const {
    data: automations,
    isError,
    isPending,
  } = useQuery(
    automationsApiOptions(organization, {
      detector: [detectorId],
      limit: 3,
    })
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text variant="muted">{t('Unable to load alert actions.')}</Text>;
  }

  if (automations.length === 0) {
    return <Text variant="muted">{t('No alert actions configured.')}</Text>;
  }

  return (
    <Stack gap="sm">
      {automations.map(automation => (
        <Flex key={automation.id} align="center" justify="between" gap="md" wrap="wrap">
          <ResourceLink
            icon={IconSiren}
            href={makeAutomationDetailsPathname(organization.slug, automation.id)}
            title={automation.name}
          />
          <AutomationActionSummary actions={getAutomationActions(automation)} />
        </Flex>
      ))}
    </Stack>
  );
}

function DetectorAlertConfig({detector}: {detector: PreviewableDetector}) {
  switch (detector.type) {
    case 'metric_issue':
      return <MetricMonitor detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeMonitor detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronMonitor detector={detector} />;
    default:
      unreachable(detector);
      return null;
  }
}

function DetectorAlertPreview({detector}: {detector: PreviewableDetector}) {
  return (
    <Stack gap="md">
      <DetectorAlertConfig detector={detector} />
      <Stack.Separator />
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Alert actions')}
        </Heading>
        <DetectorAlertActions detectorId={detector.id} />
      </Stack>
    </Stack>
  );
}

/**
 * The preview under the alert's header. Without a detector id there is nothing
 * to load, which is a legacy alert rather than a failure -- say so instead of
 * reporting an error the reader cannot act on.
 */
function DetectorAlertBody({
  detector,
  hasDetectorId,
  isError,
  isPending,
}: {
  hasDetectorId: boolean;
  isError: boolean;
  isPending: boolean;
  detector?: Detector;
}) {
  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!hasDetectorId) {
    return (
      <Text variant="muted">{t('Alert details are unavailable for legacy alerts.')}</Text>
    );
  }

  if (isError || !detector) {
    return <Text variant="muted">{t('Unable to load alert details.')}</Text>;
  }

  if (!isAlertDetector(detector)) {
    return (
      <Text variant="muted">{t('This alert type does not support block previews.')}</Text>
    );
  }

  return <DetectorAlertPreview detector={detector} />;
}

export function DetectorAlertBlock(props: EmbedOutput<'alert'>) {
  const {id, kind, name} = props;
  const organization = useOrganization();
  const href = getAlertDetailsPathname(organization, props);
  const {detectorId, isResolving} = useResolvedDetectorId(props);
  const {
    data: detector,
    isError,
    isPending,
  } = useQuery({
    ...detectorAlertApiOptions(organization.slug, detectorId),
    retry: false,
  });
  const Icon = getDetectorAlertIcon(kind as DetectorAlertKind);

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      padding="md"
      radius="md"
    >
      <Stack gap="md">
        <Flex align="center" justify="between" gap="md" wrap="wrap">
          <ResourceLink
            icon={Icon}
            href={href}
            title={detector?.name ?? name ?? t('Alert %s', id)}
          />
          {detector ? (
            <Tag variant={detector.enabled ? 'success' : 'muted'}>
              {t(
                '%s - %s',
                getDetectorAlertLabel(kind as DetectorAlertKind),
                detector.enabled ? t('Enabled') : t('Disabled')
              )}
            </Tag>
          ) : null}
        </Flex>
        <DetectorAlertBody
          detector={detector}
          hasDetectorId={Boolean(detectorId)}
          isError={isError}
          isPending={isResolving || (Boolean(detectorId) && isPending)}
        />
      </Stack>
    </Container>
  );
}
