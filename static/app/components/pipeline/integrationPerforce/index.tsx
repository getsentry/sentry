import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
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
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

const AUTH_TYPE_CHOICES = [
  {value: 'password', label: t('Password')},
  {value: 'ticket', label: t('P4 Ticket')},
];

interface InstallationConfigAdvanceData {
  authType: string;
  charset: string;
  p4port: string;
  password: string;
  user: string;
  client?: string;
  sslFingerprint?: string;
  webUrl?: string;
}

const installationConfigSchema = z
  .object({
    p4port: z.string().min(1, t('Server address is required')),
    user: z.string().min(1, t('Username is required')),
    authType: z.string().min(1, t('Authentication type is required')),
    password: z.string().min(1, t('Password is required')),
    client: z.string(),
    sslFingerprint: z.string(),
    webUrl: z.string(),
    unicodeServer: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.p4port.startsWith('ssl:') && !data.sslFingerprint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sslFingerprint'],
        message: t('SSL fingerprint is required when P4PORT uses ssl:'),
      });
    }
  });

function PerforceInstallationConfigStep({
  advance,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, unknown>, InstallationConfigAdvanceData>) {
  const form = useScrapsForm({
    defaultValues: {
      p4port: '',
      user: '',
      authType: 'password',
      password: '',
      client: '',
      sslFingerprint: '',
      webUrl: '',
      unicodeServer: false,
    },
    validators: defaultFormValidators(installationConfigSchema),
    onSubmit: ({value, createValidationError}) =>
      advance({
        p4port: value.p4port,
        user: value.user,
        authType: value.authType,
        password: value.password,
        client: value.client || undefined,
        sslFingerprint: value.sslFingerprint || undefined,
        webUrl: value.webUrl || undefined,
        // Backend stores charset as a string enum (Charset.NONE / Charset.UTF8)
        // so it can grow to other encodings without an API contract change.
        charset: value.unicodeServer ? 'utf8' : 'none',
      }).catch(error => {
        if (error instanceof RequestError) {
          const fields = requestErrorToFieldErrors(error, value);
          return fields ? createValidationError({fields}) : undefined;
        }
        throw error;
      }),
  });

  return (
    <ScrapsForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Configure your Perforce server connection to enable stacktrace linking and commit tracking.'
          )}
        </Text>
        <form.Field name="p4port">
          {field => (
            <field.Layout.Stack
              label={t('P4PORT (Server Address)')}
              hintText={t(
                "Perforce server address in P4PORT format (e.g. 'ssl:perforce.company.com:1666')"
              )}
              required
            >
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="ssl:perforce.company.com:1666"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="user">
          {field => (
            <field.Layout.Stack label={t('Perforce Username')} required>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="sentry-bot"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="authType">
          {field => (
            <field.Layout.Stack label={t('Authentication Type')} required>
              <field.Select
                value={field.value}
                onChange={field.handleChange}
                options={AUTH_TYPE_CHOICES}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="unicodeServer">
          {field => (
            <field.Layout.Stack
              label={t('Unicode Server (UTF-8)')}
              hintText={t(
                'Enable this if your Perforce server was initialized in Unicode mode (p4d -xi). Unicode servers reject clients that do not declare a charset on connect.'
              )}
            >
              <field.Switch checked={field.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="password">
          {field => (
            <field.Layout.Stack label={t('Password / Ticket')} required>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('Password or P4 ticket')}
                type="password"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="client">
          {field => (
            <field.Layout.Stack label={t('Perforce Client/Workspace')}>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="sentry-workspace"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="sslFingerprint">
          {field => (
            <field.Layout.Stack label={t('SSL Fingerprint')}>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="AB:CD:EF:..."
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="webUrl">
          {field => (
            <field.Layout.Stack label={t('P4 Code Review URL')}>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="https://swarm.company.com"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Connect')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </ScrapsForm>
  );
}

export const perforceIntegrationPipeline = {
  type: 'integration',
  provider: 'perforce',
  actionTitle: t('Installing Perforce Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring Perforce connection'),
      component: PerforceInstallationConfigStep,
    },
  ],
} as const satisfies PipelineDefinition;
