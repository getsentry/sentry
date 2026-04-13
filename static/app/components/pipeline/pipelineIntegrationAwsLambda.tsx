import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {IdBadge} from 'sentry/components/idBadge';
import {IconCheckmark, IconCode, IconFatal, IconOpen} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import type {
  PipelineCompletionProps,
  PipelineDefinition,
  PipelineStepProps,
} from './types';
import {pipelineComplete} from './types';

// Step 1: Project Select

interface ProjectSelectAdvanceData {
  projectId: number;
}

function ProjectSelectStep({
  advance,
  advanceError,
  isAdvancing,
}: PipelineStepProps<Record<string, never>, ProjectSelectAdvanceData>) {
  const {projects} = useProjects();
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.slug.localeCompare(b.slug)),
    [projects]
  );

  const autoSelectedProjectId =
    sortedProjects.length === 1 ? String(sortedProjects[0]!.id) : '';

  const projectSchema = z.object({
    projectId: z.string().min(1, t('Please select a project')),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      projectId: autoSelectedProjectId,
    },
    validators: {onDynamic: projectSchema},
    onSubmit: ({value}) => {
      advance({projectId: Number(value.projectId)});
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
          {t('Select a Sentry project to associate with your AWS Lambda functions.')}
        </Text>
        <form.AppField name="projectId">
          {field => (
            <field.Select
              aria-label={t('Project')}
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={t('Select a project')}
              options={sortedProjects.map(project => ({
                value: String(project.id),
                label: project.slug,
                leadingItems: (
                  <IdBadge
                    project={project}
                    avatarSize={20}
                    avatarProps={{consistentWidth: true}}
                    hideName
                  />
                ),
              }))}
            />
          )}
        </form.AppField>
        <Text variant="muted" size="sm">
          {t('Currently only supports Node and Python Lambda functions.')}
        </Text>
        <Flex>
          <form.SubmitButton disabled={isAdvancing}>
            {isAdvancing ? t('Submitting...') : t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

// Step 2: CloudFormation

interface CloudFormationStepData {
  baseCloudformationUrl: string;
  regionList: string[];
  stackName: string;
  templateUrl: string;
}

interface CloudFormationAdvanceData {
  accountNumber: string;
  awsExternalId: string;
  region: string;
}

const debouncedTrackInputChange = debounce(
  (fieldName: string, organization: Organization) => {
    trackIntegrationAnalytics('integrations.installation_input_value_changed', {
      integration: 'aws_lambda',
      integration_type: 'first_party',
      field_name: fieldName,
      organization,
    });
  },
  200
);

const cloudFormationSchema = z.object({
  accountNumber: z
    .string()
    .min(1, t('AWS Account Number is required'))
    .regex(/^\d{12}$/, t('Must be a 12-digit AWS account number')),
  region: z.string().min(1, t('Region is required')),
  awsExternalId: z.string().min(1, t('External ID is required')),
});

function CloudFormationStep({
  stepData,
  advance,
  advanceError,
  isAdvancing,
}: PipelineStepProps<CloudFormationStepData, CloudFormationAdvanceData>) {
  const organization = useOrganization();
  const [showExternalId, setShowExternalId] = useState(false);
  const [defaultExternalId] = useState(() => crypto.randomUUID() as string);

  const cloudFormationParams = new URLSearchParams({
    templateURL: stepData.templateUrl,
    stackName: stepData.stackName,
    param_ExternalId: defaultExternalId,
  });
  const cloudFormationUrl = `${stepData.baseCloudformationUrl}?${cloudFormationParams}`;

  const regionOptions = stepData.regionList.map(r => ({value: r, label: r}));

  const trackCloudFormationClick = useCallback(() => {
    trackIntegrationAnalytics('integrations.cloudformation_link_clicked', {
      integration: 'aws_lambda',
      integration_type: 'first_party',
      organization,
    });
  }, [organization]);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      accountNumber: '',
      region: '',
      awsExternalId: defaultExternalId,
    },
    validators: {onDynamic: cloudFormationSchema},
    onSubmit: ({value}) => advance(value),
  });

  useEffect(() => {
    if (advanceError) {
      setFieldErrors(form, advanceError);
    }
  }, [advanceError, form]);

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <Stack gap="md">
          <Heading as="h4">{t("Add Sentry's CloudFormation Stack")}</Heading>
          <Text>
            {t(
              'Sentry uses a CloudFormation stack to create a role that gives us access to instrument your Lambda functions.'
            )}
          </Text>
        </Stack>
        <Flex>
          <LinkButton
            size="sm"
            priority="link"
            href={cloudFormationUrl}
            external
            icon={<IconOpen />}
            onClick={trackCloudFormationClick}
          >
            {t("Add Sentry's CloudFormation stack")}
          </LinkButton>
        </Flex>
        <Text>
          {t('Once added enter your AWS account details to connect your account.')}
        </Text>
        <Flex gap="md">
          <form.AppField name="accountNumber">
            {field => (
              <field.Layout.Stack
                label={t('AWS Account Number')}
                hintText={t(
                  'Your Account ID can be found on the right side of the AWS header'
                )}
                variant="compact"
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value);
                    debouncedTrackInputChange('accountNumber', organization);
                  }}
                  placeholder="599817902985"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="region">
            {field => (
              <field.Layout.Stack
                label={t('AWS Region')}
                hintText={t(
                  'Your current region can be found on the right side of the AWS header'
                )}
                variant="compact"
                required
              >
                <field.Select
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value);
                    debouncedTrackInputChange('region', organization);
                  }}
                  placeholder={t('Select region')}
                  options={regionOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Flex>
        {showExternalId ? (
          <form.AppField name="awsExternalId">
            {field => (
              <field.Layout.Stack
                label={t('External ID')}
                hintText={t(
                  "The external ID from your existing CloudFormation stack's SentryRole trust policy. Only change this if you are reusing a previously created stack."
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value);
                    debouncedTrackInputChange('awsExternalId', organization);
                  }}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        ) : (
          <div>
            <Button size="xs" priority="link" onClick={() => setShowExternalId(true)}>
              {t('Using an existing CloudFormation stack?')}
            </Button>
          </div>
        )}
        <Flex>
          <form.SubmitButton disabled={isAdvancing}>
            {isAdvancing ? t('Verifying...') : t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

// Step 3: Instrumentation (function select + setup)

interface LambdaFunctionInfo {
  description: string;
  name: string;
  runtime: string;
}

interface InstrumentationFailure {
  error: string;
  name: string;
}

interface InstrumentationStepData {
  functions: LambdaFunctionInfo[];
  failures?: InstrumentationFailure[];
  successCount?: number;
}

interface InstrumentationAdvanceData {
  enabledFunctions: string[];
}

function InstrumentationStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<InstrumentationStepData, InstrumentationAdvanceData>) {
  const functions = stepData.functions;
  const failures = stepData.failures;

  const failedNames = useMemo(() => new Set(failures?.map(f => f.name)), [failures]);

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(functions.map(fn => [fn.name, true]))
  );

  const enabledCount = Object.values(enabled).filter(Boolean).length;
  const allEnabled = enabledCount === functions.length;

  const successCount = stepData.successCount;
  const failureCount = failures?.length ?? 0;
  const hasResults = successCount !== undefined;

  const results = hasResults && (
    <Flex gap="md">
      {successCount > 0 && (
        <Tag variant="success" icon={<IconCheckmark />}>
          {tn('%s function OK', '%s functions OK', successCount)}
        </Tag>
      )}
      {failureCount > 0 && (
        <Tag variant="danger" icon={<IconFatal />}>
          {tn('%s function failed', '%s functions failed', failureCount)}
        </Tag>
      )}
    </Flex>
  );

  const functionCards = functions.map(fn => {
    const isSelected = enabled[fn.name] ?? false;
    const failure = failures?.find(f => f.name === fn.name);
    return (
      <CardButton
        key={fn.name}
        role="checkbox"
        aria-checked={isSelected}
        onClick={() => setEnabled(prev => ({...prev, [fn.name]: !prev[fn.name]}))}
      >
        <Container
          border={failure ? 'danger' : isSelected ? 'accent' : 'secondary'}
          radius="md"
          padding="md"
        >
          <Flex justify="between" align="start">
            <Flex gap="sm" align="start">
              <IconCode size="sm" style={{marginTop: 2}} />
              <Stack gap="xs">
                <Text bold>{fn.name}</Text>
                <Text variant="muted" size="xs">
                  {fn.runtime}
                </Text>
                {failure && (
                  <Text variant="danger" size="xs">
                    {failure.error}
                  </Text>
                )}
              </Stack>
            </Flex>
            <Checkbox readOnly tabIndex={-1} role="presentation" checked={isSelected} />
          </Flex>
        </Container>
      </CardButton>
    );
  });

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading as="h4">
          {tn(
            'We found %s function with a supported runtime',
            'We found %s functions with supported runtimes',
            functions.length
          )}
        </Heading>
        <Text variant="muted">
          {t('Select the functions you want to instrument with Sentry.')}
        </Text>
      </Stack>
      <Flex justify="between" align="center">
        <Text>{tn('%s function selected', '%s functions selected', enabledCount)}</Text>
        <Button
          size="xs"
          priority="link"
          onClick={() => {
            const newState = !allEnabled;
            setEnabled(Object.fromEntries(functions.map(fn => [fn.name, newState])));
          }}
        >
          {allEnabled ? t('Deselect All') : t('Select All')}
        </Button>
      </Flex>
      <Grid columns="1fr 1fr" gap="md" align="start">
        {functionCards}
      </Grid>
      {results}
      <Flex justify="between" align="center">
        <Button
          priority="primary"
          size="sm"
          disabled={isAdvancing || enabledCount === 0}
          onClick={() => {
            const enabledFunctions = Object.entries(enabled)
              .filter(([_, v]) => v)
              .map(([name]) => name);
            advance({enabledFunctions});
          }}
        >
          {isAdvancing ? t('Instrumenting...') : t('Instrument Functions')}
        </Button>
        {failedNames.size > 0 && (
          <Text size="sm">
            {tct('See [link:Troubleshooting Docs]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/#troubleshooting" />
              ),
            })}
          </Text>
        )}
      </Flex>
    </Stack>
  );
}

const CardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
`;

function CompletionView({finish}: PipelineCompletionProps<IntegrationWithConfig>) {
  return (
    <Stack gap="2xl" align="start">
      <Stack gap="sm">
        <Heading as="h4">{t('AWS Lambda Integration Installed')}</Heading>
        <Text variant="muted">
          {t(
            'Your Lambda functions are now instrumented with Sentry. Errors and transactions in your functions will now be automatically reported to Sentry.'
          )}
        </Text>
      </Stack>
      <Button priority="primary" size="sm" onClick={finish}>
        {t('Done')}
      </Button>
    </Stack>
  );
}

export const awsLambdaIntegrationPipeline = {
  type: 'integration',
  provider: 'aws_lambda',
  actionTitle: t('Installing AWS Lambda Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: CompletionView,
  steps: [
    {
      stepId: 'project_select',
      shortDescription: t('Selecting a project'),
      component: ProjectSelectStep,
    },
    {
      stepId: 'cloudformation',
      shortDescription: t('Creating CloudFormation stack'),
      component: CloudFormationStep,
    },
    {
      stepId: 'instrumentation',
      shortDescription: t('Instrumenting Lambda functions'),
      component: InstrumentationStep,
    },
  ],
} as const satisfies PipelineDefinition;
