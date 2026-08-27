import type {ComponentType} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  DetectorPreview,
  type PreviewableDetector,
} from 'sentry/components/seer/markdown/embeds/components/detectorPreview';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconClock, IconGlobe, IconGraph, IconSiren} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tn} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationActionSummary} from 'sentry/views/automations/components/automationActionSummary';
import {ConditionsPanel} from 'sentry/views/automations/components/conditionsPanel';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type AlertKind = EmbedOutput<'alert'>['kind'];

function alertAutomationApiOptions(organizationSlug: string, automationId: string) {
  return apiOptions.as<Automation>()(
    '/organizations/$organizationIdOrSlug/workflows/$workflowId/',
    {
      path: {organizationIdOrSlug: organizationSlug, workflowId: automationId},
      staleTime: 30_000,
    }
  );
}

function alertDetectorApiOptions(organizationSlug: string, detectorId: string) {
  return apiOptions.as<Detector>()(
    '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
    {
      path: {organizationIdOrSlug: organizationSlug, detectorId},
      staleTime: 30_000,
    }
  );
}

function getAlertKindLabel(kind: AlertKind) {
  switch (kind) {
    case 'issue':
      return t('Issue alert');
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

function getAlertKindIcon(kind: AlertKind): ComponentType<SVGIconProps> {
  switch (kind) {
    case 'issue':
      return IconSiren;
    case 'metric':
      return IconGraph;
    case 'uptime':
      return IconGlobe;
    case 'cron':
      return IconClock;
    default:
      unreachable(kind);
      return IconSiren;
  }
}

function isAlertDetector(detector: Detector): detector is PreviewableDetector {
  return (
    detector.type === 'metric_issue' ||
    detector.type === 'uptime_domain_failure' ||
    detector.type === 'monitor_check_in_failure'
  );
}

function AutomationAlertPreview({automation}: {automation: Automation}) {
  return (
    <Stack gap="md">
      <Grid columns={{'2xs': 'minmax(0, 1fr)', sm: 'repeat(4, minmax(0, 1fr))'}} gap="md">
        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {t('Environment')}
          </Text>
          <Text>{automation.environment || t('All environments')}</Text>
        </Stack>
        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {t('Throttling')}
          </Text>
          <Text>
            {automation.config.frequency
              ? getDuration(automation.config.frequency * 60)
              : t('Every trigger')}
          </Text>
        </Stack>
        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {t('Last triggered')}
          </Text>
          <Text>
            {automation.lastTriggered ? (
              <TimeSince date={automation.lastTriggered} />
            ) : (
              t('Never')
            )}
          </Text>
        </Stack>
        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {t('Connected monitors')}
          </Text>
          <Text>{tn('%s monitor', '%s monitors', automation.detectorIds.length)}</Text>
        </Stack>
      </Grid>
      <Stack.Separator />
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Conditions and actions')}
        </Heading>
        <ErrorBoundary mini>
          <ConditionsPanel
            triggers={automation.triggers}
            actionFilters={automation.actionFilters}
          />
        </ErrorBoundary>
      </Stack>
    </Stack>
  );
}

function IssueAlertBlock({id, kind, name}: EmbedOutput<'alert'>) {
  const organization = useOrganization();
  const href = makeAutomationDetailsPathname(organization.slug, id);
  const {
    data: automation,
    isError,
    isPending,
  } = useQuery({
    ...alertAutomationApiOptions(organization.slug, id),
    retry: false,
  });

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
            icon={IconSiren}
            href={href}
            title={automation?.name ?? name ?? t('Alert %s', id)}
          />
          {automation ? (
            <Tag variant={automation.enabled ? 'success' : 'muted'}>
              {t(
                '%s - %s',
                getAlertKindLabel(kind),
                automation.enabled ? t('Enabled') : t('Disabled')
              )}
            </Tag>
          ) : null}
        </Flex>
        {isPending ? (
          <LoadingIndicator />
        ) : isError || !automation ? (
          <Text variant="muted">{t('Unable to load alert details.')}</Text>
        ) : (
          <AutomationAlertPreview automation={automation} />
        )}
      </Stack>
    </Container>
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

function DetectorAlertPreview({detector}: {detector: PreviewableDetector}) {
  return (
    <Stack gap="md">
      <DetectorPreview detector={detector} />
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

function DetectorAlertBlock({id, kind, name}: EmbedOutput<'alert'>) {
  const organization = useOrganization();
  const href = makeMonitorDetailsPathname(organization.slug, id);
  const {
    data: detector,
    isError,
    isPending,
  } = useQuery({
    ...alertDetectorApiOptions(organization.slug, id),
    retry: false,
  });
  const Icon = getAlertKindIcon(kind);

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
                getAlertKindLabel(kind),
                detector.enabled ? t('Enabled') : t('Disabled')
              )}
            </Tag>
          ) : null}
        </Flex>
        {isPending ? (
          <LoadingIndicator />
        ) : isError || !detector ? (
          <Text variant="muted">{t('Unable to load alert details.')}</Text>
        ) : isAlertDetector(detector) ? (
          <DetectorAlertPreview detector={detector} />
        ) : (
          <Text variant="muted">
            {t('This alert type does not support block previews.')}
          </Text>
        )}
      </Stack>
    </Container>
  );
}

export default function AlertBlock(props: EmbedOutput<'alert'>) {
  return props.kind === 'issue' ? (
    <IssueAlertBlock {...props} />
  ) : (
    <DetectorAlertBlock {...props} />
  );
}
