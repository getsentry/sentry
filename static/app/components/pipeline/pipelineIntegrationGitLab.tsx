import {useCallback} from 'react';
import {z} from 'zod';

import {CodeBlock} from '@sentry/scraps/code';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

const installationConfigSchema = z
  .object({
    selfHosted: z.boolean(),
    url: z.string(),
    group: z.string(),
    includeSubgroups: z.boolean(),
    verifySsl: z.boolean(),
    clientId: z.string().min(1, t('Application ID is required')),
    clientSecret: z.string().min(1, t('Application Secret is required')),
  })
  .refine(data => !data.selfHosted || z.httpUrl().safeParse(data.url).success, {
    path: ['url'],
    message: t('A valid GitLab URL is required for self-hosted instances'),
  });

interface InstallationConfigStepData {
  defaults?: {
    includeSubgroups?: boolean;
    verifySsl?: boolean;
  };
  setupValues?: Array<{label: string; value: string}>;
}

interface InstallationConfigAdvanceData {
  client_id: string;
  client_secret: string;
  group: string;
  include_subgroups?: boolean;
  url?: string;
  verify_ssl?: boolean;
}

function InstallationConfigStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<InstallationConfigStepData, InstallationConfigAdvanceData>) {
  const defaults = stepData.defaults ?? {};
  const setupValues = stepData.setupValues ?? [];

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      selfHosted: false,
      url: '',
      group: '',
      includeSubgroups: defaults.includeSubgroups ?? false,
      verifySsl: defaults.verifySsl ?? true,
      clientId: '',
      clientSecret: '',
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance({
        url: value.selfHosted ? value.url.replace(/\/+$/, '') : undefined,
        verify_ssl: value.selfHosted ? value.verifySsl : undefined,
        group: value.group,
        include_subgroups: value.group ? value.includeSubgroups : undefined,
        client_id: value.clientId,
        client_secret: value.clientSecret,
      });
    },
  });

  const configForm = (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <form.AppField name="clientId">
          {field => (
            <field.Layout.Stack label={t('GitLab Application ID')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Application ID from your GitLab OAuth application')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="clientSecret">
          {field => (
            <field.Layout.Stack label={t('GitLab Application Secret')} required>
              <field.Input
                type="password"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Application Secret from your GitLab OAuth application')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="group">
          {field => (
            <field.Layout.Stack
              label={t('GitLab Group Path')}
              hintText={t(
                'Limit this integration to a specific group. Found in the URL of your group page (e.g. my-group/my-subgroup). Leave empty to integrate all accessible projects.'
              )}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="my-group/my-subgroup"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.group}>
          {group =>
            group ? (
              <form.AppField name="includeSubgroups">
                {field => (
                  <field.Layout.Stack
                    label={t('Include Subgroups')}
                    hintText={t('Include projects in subgroups of the GitLab group.')}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            ) : null
          }
        </form.Subscribe>
        <form.AppField name="selfHosted">
          {field => (
            <field.Layout.Stack
              label={t('Self-Hosted Instance')}
              hintText={t(
                'Enable this if you are connecting to a self-hosted GitLab instance instead of gitlab.com.'
              )}
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.selfHosted}>
          {isSelfHosted =>
            isSelfHosted ? (
              <Stack gap="lg">
                <form.AppField name="url">
                  {field => (
                    <field.Layout.Stack
                      label={t('GitLab URL')}
                      hintText={t(
                        'The base URL for your self-hosted GitLab instance, including the host and protocol.'
                      )}
                      required
                    >
                      <field.Input
                        value={field.state.value}
                        onChange={field.handleChange}
                        placeholder="https://gitlab.example.com"
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
                <form.AppField name="verifySsl">
                  {field => (
                    <field.Layout.Stack
                      label={t('Verify SSL')}
                      hintText={t(
                        'Verify SSL certificates when communicating with your GitLab instance.'
                      )}
                    >
                      <field.Switch
                        checked={field.state.value}
                        onChange={field.handleChange}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              </Stack>
            ) : null
          }
        </form.Subscribe>
        <Flex>
          <form.SubmitButton disabled={isAdvancing}>
            {isAdvancing ? t('Submitting...') : t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );

  return (
    <Stack gap="lg">
      <Text>
        {t(
          'To connect Sentry with your GitLab instance, you need to create an OAuth application in GitLab.'
        )}
      </Text>
      <GuidedSteps>
        <GuidedSteps.Step
          stepKey="navigate"
          title={t('Open GitLab application settings')}
        >
          <Stack gap="xs">
            <Text density="comfortable">
              {tct(
                'Navigate to [bold:User Settings \u203A Access \u203A Applications] in GitLab.',
                {
                  bold: <strong />,
                }
              )}
            </Text>
            <Text variant="muted" size="sm">
              {tct(
                'For self-managed instances, use [bold:Admin Area \u203A Applications] instead.',
                {bold: <strong />}
              )}
            </Text>
          </Stack>
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="create" title={t('Create a new application')}>
          <Stack gap="sm">
            {setupValues.map(({label, value}) => (
              <Stack key={label} gap="xs">
                <Text bold size="sm">
                  {label}
                </Text>
                <CodeBlock>{value}</CodeBlock>
              </Stack>
            ))}
          </Stack>
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="configure" title={t('Configure the integration')}>
          {configForm}
        </GuidedSteps.Step>
      </GuidedSteps>
    </Stack>
  );
}

function GitLabOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{oauthUrl?: string}, {code: string; state: string}>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({code: data.code, state: data.state});
    },
    [advance]
  );

  return (
    <OAuthLoginStep
      oauthUrl={stepData.oauthUrl}
      isLoading={isAdvancing}
      serviceName="GitLab"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

export const gitlabIntegrationPipeline = {
  type: 'integration',
  provider: 'gitlab',
  actionTitle: t('Installing GitLab Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring GitLab connection'),
      component: InstallationConfigStep,
    },
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via GitLab OAuth flow'),
      component: GitLabOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
