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

const apiKeySchema = z.object({
  apiKey: z.string().min(1, t('API key is required')),
});

function CursorApiKeyStep({
  advance,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, never>, {apiKey: string}>) {
  const form = useScrapsForm({
    defaultValues: {apiKey: ''},
    validators: defaultFormValidators(apiKeySchema),
    onSubmit: ({value, createValidationError}) =>
      advance({apiKey: value.apiKey}).catch(error => {
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
          {t('Enter your Cursor API key to connect Cursor Agents with Sentry.')}
        </Text>
        <form.Field name="apiKey">
          {field => (
            <field.Layout.Stack label={t('Cursor API Key')} required>
              <field.Input
                type="password"
                value={field.value}
                onChange={field.handleChange}
                placeholder="crsr_..."
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
