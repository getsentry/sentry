import {useEffect, useRef} from 'react';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AwsVerificationResults} from 'sentry/components/awsVerificationResults';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {canConnectAws, type AwsVerificationResult} from 'sentry/utils/seer/awsConnection';

interface AwsSetupData {
  cloudformationUrl: string;
  externalId: string;
  permissionPolicy: string;
  sentryPrincipalArn: string;
  terraform: string;
  trustPolicy: string;
}

function AwsSetupStep({
  advance,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<AwsSetupData>) {
  return (
    <Stack gap="lg">
      <Text>
        {t(
          'Create a read-only IAM role so Seer can read CloudWatch metrics, logs, and X-Ray traces for your organization.'
        )}
      </Text>
      <Stack gap="sm">
        <Text bold>{t('Sentry Principal ARN')}</Text>
        <TextCopyInput aria-label={t('Sentry Principal ARN')}>
          {stepData?.sentryPrincipalArn ?? ''}
        </TextCopyInput>
        <Text bold>{t('External ID')}</Text>
        <TextCopyInput aria-label={t('External ID')}>
          {stepData?.externalId ?? ''}
        </TextCopyInput>
      </Stack>
      <Text>
        {tct(
          'Open CloudFormation, acknowledge that the template creates IAM resources, and create the stack. Copy the [output] output when it finishes.',
          {output: <InlineCode>RoleArn</InlineCode>}
        )}
      </Text>
      <Flex>
        <LinkButton
          external
          href={stepData?.cloudformationUrl ?? ''}
          disabled={isInitializing || !stepData?.cloudformationUrl}
        >
          {t('Open CloudFormation')}
        </LinkButton>
      </Flex>
      <Disclosure>
        <Disclosure.Title>{t('Set up with Terraform or IAM policies')}</Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="md">
            <Text bold>{t('Terraform')}</Text>
            <CodeBlock language="hcl">{stepData?.terraform ?? ''}</CodeBlock>
            <Text bold>{t('Trust Policy')}</Text>
            <CodeBlock language="json">{stepData?.trustPolicy ?? ''}</CodeBlock>
            <Text bold>{t('Permissions Policy')}</Text>
            <CodeBlock language="json">{stepData?.permissionPolicy ?? ''}</CodeBlock>
          </Stack>
        </Disclosure.Content>
      </Disclosure>
      <Flex>
        <Button
          variant="primary"
          onClick={() => advance()}
          busy={isAdvancing}
          disabled={isInitializing || !stepData?.externalId}
        >
          {t('Continue')}
        </Button>
      </Flex>
    </Stack>
  );
}

const configSchema = z.object({
  roleArn: z.string().trim().min(1, t('Enter an IAM role ARN')).max(2048),
  regions: z.array(z.string()).min(1, t('Select at least one AWS region')),
});

function AwsCustomerConfigStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<{regions: string[]}, {regions: string[]; roleArn: string}>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {roleArn: '', regions: [] as string[]},
    validators: {onDynamic: configSchema},
    onSubmit: ({value}) => advance(configSchema.parse(value)),
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
            'Enter the role ARN from your stack and select the regions Seer should query.'
          )}
        </Text>
        <form.AppField name="roleArn">
          {field => (
            <field.Layout.Stack label={t('IAM Role ARN')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="arn:aws:iam::123456789012:role/SentrySeerAccess"
                disabled={isAdvancing}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="regions">
          {field => (
            <field.Layout.Stack label={t('AWS Regions')} required>
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={(stepData?.regions ?? []).map(region => ({
                  value: region,
                  label: region,
                }))}
                disabled={isAdvancing}
              />
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

function AwsVerificationStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<
  {verification: AwsVerificationResult | null},
  {action: 'verify' | 'finish'}
>) {
  const started = useRef(false);
  useEffect(() => {
    if (!isInitializing && stepData && !started.current) {
      started.current = true;
      if (!stepData.verification) {
        advance({action: 'verify'});
      }
    }
  }, [advance, isInitializing, stepData]);
  const result = stepData?.verification;
  return (
    <Stack gap="lg">
      <Text>
        {t(
          'Sentry checks that your role requires the external ID, then tests read access in each selected region.'
        )}
      </Text>
      <Stack role="status" aria-live="polite">
        {isAdvancing ? (
          <LoadingIndicator />
        ) : result ? (
          <AwsVerificationResults result={result} />
        ) : null}
      </Stack>
      {result && canConnectAws(result) && result.connectionStatus !== 'connected' && (
        <Text>
          {t(
            'Seer will use the connected regions. Fix access to the other regions and re-test from integration settings.'
          )}
        </Text>
      )}
      <Flex gap="md">
        <Button
          variant="primary"
          onClick={() => advance({action: 'finish'})}
          busy={isAdvancing}
          disabled={
            isInitializing ||
            isAdvancing ||
            Boolean(advanceError) ||
            !canConnectAws(result)
          }
        >
          {t('Finish setup')}
        </Button>
        <Button
          onClick={() => advance({action: 'verify'})}
          disabled={isInitializing || isAdvancing}
        >
          {t('Re-test')}
        </Button>
      </Flex>
    </Stack>
  );
}

export const awsIntegrationPipeline = {
  type: 'integration',
  provider: 'aws',
  actionTitle: t('Installing AWS for Seer'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'aws_setup',
      shortDescription: t('Creating AWS role'),
      component: AwsSetupStep,
    },
    {
      stepId: 'aws_customer_config',
      shortDescription: t('Configuring AWS connection'),
      component: AwsCustomerConfigStep,
    },
    {
      stepId: 'aws_verification',
      shortDescription: t('Verifying AWS connection'),
      component: AwsVerificationStep,
    },
  ],
} as const satisfies PipelineDefinition;
