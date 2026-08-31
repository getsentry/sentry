import {Fragment, useEffect, useRef} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete, IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import type {
  GcpProjectResult,
  GcpVerificationInput,
  GcpVerifyConnectionResponse,
} from 'sentry/utils/seer/gcpConnection';
import {
  describeService,
  getFailedServices,
  getProjectErrorDetail,
  getStatusLabel,
  getStatusVariant,
} from 'sentry/utils/seer/gcpConnection';
import {useOrganization} from 'sentry/utils/useOrganization';

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
      setFieldErrors(form, requestErrorToFieldErrors(advanceError, form.state.values));
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

interface GcpVerificationStepData {
  customerSaEmail: string;
  projects: string[];
}

function GcpProjectStatus({project}: {project: GcpProjectResult}) {
  const failedServices = getFailedServices(project);

  return (
    <Stack gap="xs">
      <Flex gap="sm" align="center">
        <StatusIndicator
          variant={getStatusVariant(project.connectionStatus)}
          animationIterationCount={1}
        />
        <Text bold>{project.gcpProjectId}</Text>
        <Text variant="muted" size="sm">
          {getStatusLabel(project.connectionStatus)}
        </Text>
      </Flex>
      {failedServices.map(service => (
        <Text key={service.service} variant="muted" size="sm">
          {describeService(service)}
        </Text>
      ))}
    </Stack>
  );
}

function GcpVerificationStep({
  advance,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<GcpVerificationStepData, GcpVerificationInput>) {
  const organization = useOrganization();
  const customerSaEmail = stepData?.customerSaEmail ?? '';
  const projects = stepData?.projects;

  const {
    mutate: verify,
    data: result,
    isPending,
    isError,
  } = useMutation<GcpVerifyConnectionResponse>({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/gcp/verify-connection/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        method: 'POST',
        data: {customerSaEmail, gcpProjectIds: projects},
      }),
  });

  const canVerify = Boolean(customerSaEmail && projects?.length);

  const hasVerifiedRef = useRef(false);
  useEffect(() => {
    if (hasVerifiedRef.current || !canVerify) {
      return;
    }
    hasVerifiedRef.current = true;
    verify();
  }, [verify, canVerify]);

  const isChecking = isPending || (canVerify && !result && !isError);
  const isConnected = result?.connectionStatus === 'connected';
  const continueLabel = isChecking || isConnected ? t('Continue') : t('Continue Anyway');

  function handleContinue() {
    if (result) {
      advance({
        connectionStatus: result.connectionStatus,
        projects: result.projects.map(project => ({
          gcpProjectId: project.gcpProjectId,
          connectionStatus: project.connectionStatus,
          errorDetail: getProjectErrorDetail(project),
        })),
      });
      return;
    }

    // The check never completed, so record it as an error against every
    // configured project. The customer can re-test from the settings page.
    advance({
      connectionStatus: 'error',
      projects: (projects ?? []).map(gcpProjectId => ({
        gcpProjectId,
        connectionStatus: 'error' as const,
        errorDetail: 'Verification could not be completed.',
      })),
    });
  }

  return (
    <Stack gap="lg">
      <Text>
        {t(
          'Sentry is testing that it can read Cloud Logging, Cloud Monitoring, and Cloud Trace data from each of your GCP projects.'
        )}
      </Text>

      <Stack gap="md" role="status" aria-live="polite">
        {isChecking ? (
          <Flex gap="sm" align="center">
            <LoadingIndicator mini />
            <Text variant="muted">{t('Testing your GCP connection...')}</Text>
          </Flex>
        ) : isError ? (
          <Alert variant="warning">
            {t(
              'We could not complete the connection test. You can finish setup and re-test from the integration settings page.'
            )}
          </Alert>
        ) : result ? (
          <Fragment>
            <Alert variant={isConnected ? 'success' : 'warning'}>
              {isConnected
                ? t('Sentry can read telemetry from all of your connected GCP projects.')
                : t(
                    'Sentry could not read telemetry from every project. IAM changes can take a couple of minutes to take effect, so re-testing may help. You can also finish setup and re-test from the integration settings page.'
                  )}
            </Alert>
            {result.projects.map(project => (
              <GcpProjectStatus key={project.gcpProjectId} project={project} />
            ))}
          </Fragment>
        ) : null}
      </Stack>

      <Flex gap="md">
        <Button
          variant="primary"
          onClick={handleContinue}
          busy={isAdvancing}
          disabled={isInitializing || isChecking || isAdvancing}
        >
          {continueLabel}
        </Button>
        <Button
          icon={<IconRefresh size="xs" />}
          onClick={() => verify()}
          disabled={isInitializing || isChecking || isAdvancing || !canVerify}
        >
          {t('Re-test')}
        </Button>
      </Flex>
    </Stack>
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
    {
      stepId: 'gcp_verification',
      shortDescription: t('Verifying GCP connection'),
      component: GcpVerificationStep,
    },
  ],
} as const satisfies PipelineDefinition;
