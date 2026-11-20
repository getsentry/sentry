import {useEffect} from 'react';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {downloadObjectAsJson} from 'sentry/utils/downloadObjectAsJson';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

interface AwsRoleStepData {
  cloudFormationTemplate: Record<string, unknown>;
  externalId: string;
  principalArn: string;
  regions: string[];
}

const roleSchema = z.object({
  roleArn: z
    .string()
    .trim()
    .max(2048)
    .regex(
      /^arn:aws:iam::\d{12}:role\/(?:[\w+=,.@-]+\/)*[\w+=,.@-]{1,64}$/,
      t('Enter an AWS IAM role ARN.')
    ),
  region: z.string().min(1, t('Select an AWS MCP region.')),
});

function AwsRoleStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
  stepData,
}: PipelineStepProps<AwsRoleStepData, {region: string; roleArn: string}>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {roleArn: '', region: stepData?.regions[0] ?? ''},
    validators: {onDynamic: roleSchema},
    onSubmit: ({value}) => advance({...value, roleArn: value.roleArn.trim()}),
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
            'Connect an AWS role so Seer can read CloudWatch metrics and logs, X-Ray traces, and EC2/ECS resource information. Everyone with access to Seer in your Sentry organization shares this role’s telemetry access.'
          )}
        </Text>
        <Stack as="ol" gap="md">
          <li>
            <Stack gap="sm">
              <Text>
                {t('Download the CloudFormation template for your organization.')}
              </Text>
              <Flex>
                <Button
                  disabled={isInitializing || !stepData}
                  onClick={() => {
                    if (stepData) {
                      downloadObjectAsJson(
                        stepData.cloudFormationTemplate,
                        'sentry-seer-aws'
                      );
                    }
                  }}
                >
                  {t('Download template')}
                </Button>
              </Flex>
            </Stack>
          </li>
          <li>
            <Stack gap="sm">
              <Text>
                {t(
                  'Create a CloudFormation stack in the AWS account you want to connect. Upload the template, acknowledge IAM resource creation, and wait for the stack to finish.'
                )}
              </Text>
              <Flex>
                <LinkButton
                  external
                  href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/template"
                >
                  {t('Open CloudFormation')}
                </LinkButton>
              </Flex>
            </Stack>
          </li>
          <li>
            <Text>
              {t(
                'Copy RoleArn from the stack’s Outputs tab into the field below. Seer will verify the role’s trust policy and read metrics, logs, and traces before connecting.'
              )}
            </Text>
          </li>
        </Stack>
        <Stack gap="sm">
          <Text bold>{t('Sentry Workload Role')}</Text>
          <TextCopyInput aria-label={t('Sentry Workload Role')}>
            {stepData?.principalArn ?? ''}
          </TextCopyInput>
          <Text bold>{t('External ID')}</Text>
          <TextCopyInput aria-label={t('External ID')}>
            {stepData?.externalId ?? ''}
          </TextCopyInput>
          <Text variant="muted" size="sm">
            {t(
              'These values are managed by Sentry and stay the same when you restart setup. If another team manages your AWS infrastructure, send them the template.'
            )}
          </Text>
        </Stack>
        <form.AppField name="roleArn">
          {field => (
            <field.Layout.Stack label={t('IAM Role ARN')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="arn:aws:iam::123456789012:role/SeerTelemetry"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="region">
          {field => (
            <field.Layout.Stack
              label={t('AWS MCP Region')}
              hintText={t(
                'The region hosting the MCP server. Seer can query other AWS regions.'
              )}
              required
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={(stepData?.regions ?? []).map(region => ({
                  value: region,
                  label: region,
                }))}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing || !stepData}>
            {t('Verify and connect')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
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
      stepId: 'aws_role',
      shortDescription: t('Connecting your AWS telemetry role'),
      component: AwsRoleStep,
    },
  ],
} as const satisfies PipelineDefinition;
