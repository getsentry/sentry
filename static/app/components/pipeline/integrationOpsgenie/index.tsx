import {z} from 'zod';

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
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {RequestError} from 'sentry/utils/requestError/requestError';

interface BaseUrlChoice {
  label: string;
  value: string;
}

interface InstallationConfigStepData {
  baseUrlChoices?: BaseUrlChoice[];
}

interface InstallationConfigAdvanceData {
  baseUrl: string;
  provider: string;
  apiKey?: string;
}

const installationConfigSchema = z.object({
  baseUrl: z.string().min(1, t('Base URL is required')),
  provider: z.string().min(1, t('Account name is required')),
  apiKey: z.string(),
});

function OpsgenieInstallationConfigStep({
  stepData,
  advance,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<InstallationConfigStepData, InstallationConfigAdvanceData>) {
  const choices = stepData?.baseUrlChoices ?? [];

  const form = useScrapsForm({
    defaultValues: {
      baseUrl: choices[0]?.value ?? '',
      provider: '',
      apiKey: '',
    },
    validators: defaultFormValidators(installationConfigSchema),
    onSubmit: ({value, createValidationError}) =>
      advance({
        baseUrl: value.baseUrl,
        provider: value.provider,
        apiKey: value.apiKey || undefined,
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
            'Configure your Opsgenie integration to start receiving Sentry alerts in Opsgenie.'
          )}
        </Text>
        <form.Field name="baseUrl">
          {field => (
            <field.Layout.Stack label={t('Base URL')} required>
              <field.Select
                value={field.value}
                onChange={field.handleChange}
                options={choices.map(c => ({value: c.value, label: c.label}))}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="provider">
          {field => (
            <field.Layout.Stack
              label={t('Account Name')}
              hintText={t("Example: 'acme' for https://acme.app.opsgenie.com/")}
              required
            >
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('your-account-name')}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="apiKey">
          {field => (
            <field.Layout.Stack
              label={t('Opsgenie Integration Key')}
              hintText={t(
                'Optionally, add your first integration key for sending alerts. You can rename this key later.'
              )}
            >
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('Integration key (optional)')}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </ScrapsForm>
  );
}

export const opsgenieIntegrationPipeline = {
  type: 'integration',
  provider: 'opsgenie',
  actionTitle: t('Installing Opsgenie Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring Opsgenie connection'),
      component: OpsgenieInstallationConfigStep,
    },
  ],
} as const satisfies PipelineDefinition;
