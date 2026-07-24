import {Fragment, useEffect} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

const GCP_PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const MAX_PROJECTS = 20;

function GcpSaGenerationStep({
  advance,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<{sentrySaEmail: string}>) {
  const sentrySaEmail = stepData?.sentrySaEmail ?? '';

  return (
    <Stack gap="lg">
      <Text>
        {t(
          'Sentry has generated a service account for your organization. Follow the steps below to grant it access to your GCP projects, then click Continue.'
        )}
      </Text>
      <Stack gap="sm">
        <Text bold>{t('Sentry Service Account')}</Text>
        <TextCopyInput>{sentrySaEmail}</TextCopyInput>
      </Stack>
      <Stack gap="sm">
        <Text bold>{t('Setup Instructions')}</Text>
        <Stack as="ol" gap="sm">
          <li>
            <Text>
              {t(
                'Create a service account in your GCP project for Sentry to impersonate.'
              )}
            </Text>
          </li>
          <li>
            <Text>
              {t(
                'Grant your service account the required viewer roles on each GCP project you want to connect.'
              )}
            </Text>
          </li>
          <li>
            <Text>
              {tct(
                'Grant the Sentry service account above the [role] role on your service account.',
                {role: <strong>{t('Service Account Token Creator')}</strong>}
              )}
            </Text>
          </li>
        </Stack>
      </Stack>
      <Flex>
        <Button
          variant="primary"
          onClick={() => advance()}
          busy={isAdvancing}
          disabled={isInitializing || !sentrySaEmail}
        >
          {t('Continue')}
        </Button>
      </Flex>
    </Stack>
  );
}

const gcpCustomerConfigSchema = z.object({
  customerSaEmail: z.email(t('Must be a valid email address')),
  projects: z
    .array(z.string().regex(GCP_PROJECT_ID_RE, t('Invalid project ID')))
    .min(1, t('At least one project ID is required'))
    .max(MAX_PROJECTS),
});

function GcpCustomerConfigStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<
  Record<string, never>,
  {customerSaEmail: string; projects: string[]}
>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {customerSaEmail: '', projects: ['']},
    validators: {onDynamic: gcpCustomerConfigSchema},
    onSubmit: ({value}) => {
      advance({
        customerSaEmail: value.customerSaEmail,
        projects: value.projects.map(s => s.trim()).filter(Boolean),
      });
    },
  });

  useEffect(() => {
    if (advanceError) {
      setFieldErrors(form, advanceError);
    }
  }, [advanceError, form]);

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Enter your GCP service account email and the project IDs you want to connect to Seer.'
          )}
        </Text>
        <form.AppField name="customerSaEmail">
          {field => (
            <field.Layout.Stack label={t('Service Account Email')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="gcp-sentry@your-project.iam.gserviceaccount.com"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="projects" mode="array">
          {field => (
            <Fragment>
              <Text bold>{t('GCP Project IDs')}</Text>
              <Stack gap="sm">
                {field.state.value.map((_, i) => (
                  <Flex key={i} gap="sm" align="center">
                    <form.AppField name={`projects[${i}]`}>
                      {subField => (
                        <subField.Input
                          value={subField.state.value}
                          onChange={subField.handleChange}
                          placeholder="my-gcp-project"
                          style={{flex: 1}}
                        />
                      )}
                    </form.AppField>
                    {field.state.value.length > 1 && (
                      <Button
                        aria-label={t('Remove project')}
                        size="sm"
                        variant="transparent"
                        icon={<IconDelete size="xs" />}
                        onClick={() => field.removeValue(i)}
                      />
                    )}
                  </Flex>
                ))}
                {field.state.value.length < MAX_PROJECTS && (
                  <Flex>
                    <Button
                      size="sm"
                      icon={<IconAdd size="xs" />}
                      onClick={() => field.pushValue('')}
                    >
                      {t('Add Project')}
                    </Button>
                  </Flex>
                )}
                <field.Meta.Status />
              </Stack>
            </Fragment>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

export const gcpIntegrationPipeline = {
  type: 'integration',
  provider: 'gcp',
  actionTitle: t('Installing Google Cloud Platform'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'gcp_sa_generation',
      shortDescription: t('Setting up GCP service account'),
      component: GcpSaGenerationStep,
    },
    {
      stepId: 'gcp_customer_config',
      shortDescription: t('Configuring GCP connection'),
      component: GcpCustomerConfigStep,
    },
  ],
} as const satisfies PipelineDefinition;
