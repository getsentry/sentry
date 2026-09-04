import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconSiren} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConditionsPanel} from 'sentry/views/automations/components/conditionsPanel';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

function issueAlertApiOptions(organizationSlug: string, automationId: string) {
  return apiOptions.as<Automation>()(
    '/organizations/$organizationIdOrSlug/workflows/$workflowId/',
    {
      path: {organizationIdOrSlug: organizationSlug, workflowId: automationId},
      staleTime: 30_000,
    }
  );
}

function IssueAlertPreview({automation}: {automation: Automation}) {
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

export function IssueAlertBlock({id, name}: EmbedOutput<'alert'>) {
  const organization = useOrganization();
  const href = makeAutomationDetailsPathname(organization.slug, id);
  const {
    data: automation,
    isError,
    isPending,
  } = useQuery({
    ...issueAlertApiOptions(organization.slug, id),
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
                t('Issue alert'),
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
          <IssueAlertPreview automation={automation} />
        )}
      </Stack>
    </Container>
  );
}
