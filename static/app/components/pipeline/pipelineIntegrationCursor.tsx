import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

const apiKeySchema = z.object({
  apiKey: z.string().min(1, t('API key is required')),
});

function CursorApiKeyStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, never>, {apiKey: string}>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {apiKey: ''},
    validators: {onDynamic: apiKeySchema},
    onSubmit: ({value}) => {
      advance({apiKey: value.apiKey});
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
          {t('Enter your Cursor API key to connect Cursor Agents with Sentry.')}
        </Text>
        <form.AppField name="apiKey">
          {field => (
            <field.Layout.Stack label={t('Cursor API Key')} required>
              <field.Input
                type="password"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="crsr_..."
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton disabled={isAdvancing || isInitializing}>
            {isAdvancing ? t('Submitting...') : t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

export const cursorIntegrationPipeline = {
  type: 'integration',
  provider: 'cursor',
  actionTitle: t('Installing Cursor Agent'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'api_key_config',
      shortDescription: t('Configuring API key'),
      component: CursorApiKeyStep,
    },
  ],
} as const satisfies PipelineDefinition;
