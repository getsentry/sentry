import {useCallback, useEffect} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {useRedirectPopupStep} from 'sentry/components/pipeline/shared/useRedirectPopupStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

const installationConfigSchema = z.object({
  url: z
    .string()
    .min(1, t('Jira URL is required'))
    .url(t('Enter a valid URL'))
    .transform(v => v.replace(/\/+$/, '')),
  consumerKey: z
    .string()
    .min(1, t('Consumer Key is required'))
    .max(200, t('Consumer Key is limited to 200 characters')),
  privateKey: z.string().min(1, t('Private Key is required')),
  verifySsl: z.boolean(),
});

interface InstallationConfigAdvanceData {
  consumerKey: string;
  privateKey: string;
  url: string;
  verifySsl: boolean;
}

function InstallationConfigStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, never>, InstallationConfigAdvanceData>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      url: '',
      consumerKey: '',
      privateKey: '',
      verifySsl: true,
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance(installationConfigSchema.parse(value));
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
          {tct(
            'You must complete the [link:required steps] on your Jira Server instance before connecting it to Sentry, then enter the application credentials below.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/issue-tracking/jira/#jira-server" />
              ),
            }
          )}
        </Text>

        <form.AppField name="url">
          {field => (
            <field.Layout.Stack
              label={t('Jira URL')}
              hintText={t(
                'The base URL for your Jira Server instance, including the host and protocol.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://jira.example.com"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="consumerKey">
          {field => (
            <field.Layout.Stack
              label={t('Jira Consumer Key')}
              hintText={t('The consumer key configured on the Application Link.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="sentry-consumer-key"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="privateKey">
          {field => (
            <field.Layout.Stack
              label={t('Jira Consumer Private Key')}
              hintText={t('The RSA private key paired with the Application Link.')}
              required
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                rows={3}
                placeholder={
                  '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                }
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="verifySsl">
          {field => (
            <field.Layout.Stack
              label={t('Verify SSL')}
              hintText={t(
                'Verify SSL certificates when making requests to your Jira instance.'
              )}
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
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

interface OAuthStepData {
  oauthUrl?: string;
}

function OAuthCallbackStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<OAuthStepData, {oauthToken: string}>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      if (data.oauth_token) {
        advance({oauthToken: data.oauth_token});
      }
    },
    [advance]
  );

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.oauthUrl,
    onCallback: handleCallback,
  });

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {t(
            'Authorize Sentry on your Jira Server instance to complete the integration setup.'
          )}
        </Text>
        {isWaitingForCallback && (
          <Text variant="muted" size="sm">
            {t('A popup should have opened to authorize with Jira Server.')}
          </Text>
        )}
        {popupStatus === 'failed-to-open' && (
          <Text variant="danger" size="sm">
            {t(
              'The authorization popup was blocked by your browser. Please ensure popups are allowed and try again.'
            )}
          </Text>
        )}
      </Stack>
      {isWaitingForCallback && !isAdvancing ? (
        <Button size="sm" onClick={openPopup}>
          {t('Reopen authorization window')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={openPopup}
          busy={isAdvancing}
          disabled={!stepData?.oauthUrl}
        >
          {t('Authorize Jira Server')}
        </Button>
      )}
    </Stack>
  );
}

export const jiraServerIntegrationPipeline = {
  type: 'integration',
  provider: 'jira_server',
  actionTitle: t('Installing Jira Server Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring Jira Server connection'),
      component: InstallationConfigStep,
    },
    {
      stepId: 'oauth_callback',
      shortDescription: t('Authorizing via OAuth'),
      component: OAuthCallbackStep,
    },
  ],
} as const satisfies PipelineDefinition;
