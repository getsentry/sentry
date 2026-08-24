import {Fragment} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  defaultFormValidators,
  ScrapsForm,
  toFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
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
import {RequestError} from 'sentry/utils/requestError/requestError';

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
  isAdvancing,
  isInitializing,
}: PipelineStepProps<
  Record<string, never>,
  {customerSaEmail: string; projects: string[]}
>) {
  const form = useScrapsForm({
    defaultValues: {customerSaEmail: '', projects: ['']},
    validators: defaultFormValidators(gcpCustomerConfigSchema),
    onSubmit: ({value, createValidationError}) =>
      advance({
        customerSaEmail: value.customerSaEmail,
        projects: value.projects.map(s => s.trim()).filter(Boolean),
      }).catch(error => {
        if (error instanceof RequestError) {
          return toFieldErrors({value, createValidationError}, error);
        }
        throw error;
      }),
  });

  return (
    <ScrapsForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Enter your GCP service account email and the project IDs you want to connect to Seer.'
          )}
        </Text>
        <form.Field name="customerSaEmail">
          {field => (
            <field.Layout.Stack label={t('Service Account Email')} required>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="gcp-sentry@your-project.iam.gserviceaccount.com"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.ArrayField name="projects">
          {field => (
            <Fragment>
              <Text bold>{t('GCP Project IDs')}</Text>
              <Stack gap="sm">
                {field.value.map((_, i) => (
                  <Flex key={i} gap="sm" align="center">
                    <form.Field name={`projects[${i}]`}>
                      {subField => (
                        <subField.Input
                          value={subField.value}
                          onChange={subField.handleChange}
                          placeholder="my-gcp-project"
                          style={{flex: 1}}
                        />
                      )}
                    </form.Field>
                    {field.value.length > 1 && (
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
                {field.value.length < MAX_PROJECTS && (
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
                <form.Field name="projects">
                  {projectsField => <projectsField.Meta.Status />}
                </form.Field>
              </Stack>
            </Fragment>
          )}
        </form.ArrayField>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </ScrapsForm>
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
