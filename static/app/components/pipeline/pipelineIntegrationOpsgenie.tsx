import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

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
  advanceError,
  isAdvancing,
}: PipelineStepProps<InstallationConfigStepData, InstallationConfigAdvanceData>) {
  const choices = stepData.baseUrlChoices ?? [];

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      baseUrl: choices[0]?.value ?? '',
      provider: '',
      apiKey: '',
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance({
        baseUrl: value.baseUrl,
        provider: value.provider,
        apiKey: value.apiKey || undefined,
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
            'Configure your Opsgenie integration to start receiving Sentry alerts in Opsgenie.'
          )}
        </Text>
        <form.AppField name="baseUrl">
          {field => (
            <field.Layout.Stack label={t('Base URL')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={choices.map(c => ({value: c.value, label: c.label}))}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="provider">
          {field => (
            <field.Layout.Stack
              label={t('Account Name')}
              hintText={t("Example: 'acme' for https://acme.app.opsgenie.com/")}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('your-account-name')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="apiKey">
          {field => (
            <field.Layout.Stack
              label={t('Opsgenie Integration Key')}
              hintText={t(
                'Optionally, add your first integration key for sending alerts. You can rename this key later.'
              )}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Integration key (optional)')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton disabled={isAdvancing}>
            {isAdvancing ? t('Submitting...') : t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
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
