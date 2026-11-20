import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Tag} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DisplayField, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {WorkflowStrategy} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

import {AgenticTriageForm} from './agenticTriageForm';
import {FormSection, MetricAutomationForm} from './metricAutomationForm';

const STRATEGIES = [
  'breached_metric_investigation',
  'agentic_triage_v2',
] as const satisfies WorkflowStrategy[];

const strategyParser = parseAsStringLiteral(STRATEGIES)
  .withDefault('breached_metric_investigation')
  // Keeps the selected strategy in the URL even when it is the default
  .withOptions({clearOnDefault: false});

export default function NewAutomationPage() {
  const organization = useOrganization();
  const enabled = useAutomationsEnabled();
  const [strategy, setStrategy] = useQueryState('strategy', strategyParser);

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
            <Tag variant="muted">{STRATEGY_META[strategy].label}</Tag>
          </Flex>
          {strategy === 'breached_metric_investigation' && (
            <Text variant="muted">
              {t('Connect metric monitors so Seer can investigate what caused a breach.')}
            </Text>
          )}
        </Stack>
        <Container maxWidth="960px" width="100%" containerType="inline-size">
          <FormSection title={t('Strategy')}>
            <FieldGroup>
              <DisplayField.Row
                label={t('Strategy')}
                hintText={t('Decides what this automation does and when it runs.')}
              >
                <CompactSelect
                  value={strategy}
                  onChange={option => setStrategy(option.value)}
                  options={[
                    {
                      value: 'breached_metric_investigation',
                      label: t('Breached Metric'),
                    },
                    {value: 'agentic_triage_v2', label: t('Agentic Triage')},
                  ]}
                />
              </DisplayField.Row>
            </FieldGroup>
          </FormSection>
        </Container>
        {strategy === 'agentic_triage_v2' ? (
          <AgenticTriageForm mode="create" />
        ) : (
          <MetricAutomationForm mode="create" />
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}
