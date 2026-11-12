import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

import {MetricAutomationForm} from './metricAutomationForm';

export default function NewMetricAutomation() {
  const organization = useOrganization();
  const enabled = useAutomationsEnabled();

  if (!enabled) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={t('Create automation')} orgSlug={organization.slug}>
      <Stack padding="xl" gap="xl" containerType="inline-size">
        <TopBar.Slot
          name="breadcrumbs"
          title={{type: 'page-title', label: t('Create automation')}}
          items={[
            {
              type: 'link',
              label: t('Automations'),
              to: getAutomationsPath(organization.slug),
            },
          ]}
        />
        <Stack gap="sm">
          <Flex gap="md" align="center" wrap="wrap">
            <Heading as="h1" size="xl">
              {t('Create automation')}
            </Heading>
            <Tag variant="muted">{t('Breached metrics')}</Tag>
          </Flex>
          <Text variant="muted">
            {t('Connect metric monitors so Seer can investigate what caused a breach.')}
          </Text>
        </Stack>
        <MetricAutomationForm mode="create" />
      </Stack>
    </SentryDocumentTitle>
  );
}
