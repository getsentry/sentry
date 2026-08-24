import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  defineAppFieldGroup,
  FieldGroup,
  ScrapsForm,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {DataForwarderDeleteConfirm} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderDeleteConfirm';
import {
  baseDataForwarderSchema,
  baseFormEditDefaults,
  baseFormSetupDefaults,
  buildProjectOptions,
  EnablementFields,
  ProjectConfigFields,
} from 'sentry/views/settings/organizationDataForwarding/util/forms';
import {
  DataForwarderProviderSlug,
  type DataForwarder,
  type DataForwarderPayload,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

const sqsSchema = baseDataForwarderSchema.extend({
  queue_url: z.string().min(1, t('Queue URL is required')),
  region: z.string().min(1, t('Region is required')),
  access_key: z.string().min(1, t('Access key is required')),
  secret_key: z.string().min(1, t('Secret key is required')),
  message_group_id: z.string(),
  s3_bucket: z.string(),
});

const sqsDefaults = {
  queue_url: '',
  region: '',
  access_key: '',
  secret_key: '',
  message_group_id: '',
  s3_bucket: '',
};

function buildSqsConfig(
  fields: Omit<
    z.infer<typeof sqsSchema>,
    'is_enabled' | 'enroll_new_projects' | 'project_ids'
  >
): Record<string, string | undefined> {
  return {
    queue_url: fields.queue_url,
    region: fields.region,
    access_key: fields.access_key,
    secret_key: fields.secret_key,
    message_group_id: fields.message_group_id || undefined,
    s3_bucket: fields.s3_bucket || undefined,
  };
}

/**
 * Reusable field group for SQS-specific configuration fields.
 */
const sqsConfigFieldGroup = defineAppFieldGroup(({strict}) => ({
  queue_url: strict<string>(),
  region: strict<string>(),
  access_key: strict<string>(),
  secret_key: strict<string>(),
  message_group_id: strict<string>(),
  s3_bucket: strict<string>(),
}));

function SQSConfigFieldsImpl({
  fields,
  disabled,
}: {
  disabled: boolean;
  fields: typeof sqsConfigFieldGroup.fields;
}) {
  return (
    <FieldGroup title={t('Global Configuration')}>
      <fields.Field name="queue_url">
        {field => (
          <field.Layout.Row
            label={t('Queue URL')}
            hintText={t('The URL of the SQS queue to forward events to.')}
            required
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. https://sqs.us-east-1.amazonaws.com/12345678/myqueue"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="region">
        {field => (
          <field.Layout.Row
            label={t('Region')}
            hintText={t('The region of the SQS queue to forward events to.')}
            required
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. us-east-1"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="access_key">
        {field => (
          <field.Layout.Row
            label={t('Access Key')}
            hintText={t('Currently only long-term IAM access keys are supported.')}
            required
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="secret_key">
        {field => (
          <field.Layout.Row
            label={t('Secret Key')}
            hintText={t('Only visible once when the access key is created.')}
            required
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. wJalrXUtnFEMI1K7MDENGSbPxRfiCYEXAMPLEKEY"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="message_group_id">
        {field => (
          <field.Layout.Row
            label={t('Message Group ID')}
            hintText={t('Required for FIFO queues, exclude for standard queues')}
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. my-message-group-id"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="s3_bucket">
        {field => (
          <field.Layout.Row
            label={t('S3 Bucket')}
            hintText={t(
              'Specify a bucket to store events in S3. The SQS message will contain a reference to the payload location in S3. If no S3 bucket is provided, events over the SQS limit of 256KB will not be forwarded.'
            )}
          >
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              placeholder="e.g. my-s3-bucket"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
    </FieldGroup>
  );
}

const SQSConfigFields = sqsConfigFieldGroup.bindComponent(SQSConfigFieldsImpl, 'fields');

export function SQSSetupForm({
  projects,
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (payload: DataForwarderPayload) => void;
  projects: Project[];
}) {
  const form = useScrapsForm({
    defaultValues: {...baseFormSetupDefaults, ...sqsDefaults},
    validators: [{run: sqsSchema, triggers: ['change']}],
    onSubmit: ({value}) => {
      const {
        is_enabled: _is_enabled,
        enroll_new_projects,
        project_ids,
        ...configFields
      } = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SQS,
        config: buildSqsConfig(configFields),
        is_enabled: true,
        enroll_new_projects,
        project_ids,
      } satisfies DataForwarderPayload);
    },
  });

  const projectOptions = buildProjectOptions(projects);

  return (
    <ScrapsForm form={form}>
      <EnablementFields
        form={form}
        fields={{is_enabled: 'is_enabled'}}
        disabled={disabled}
        isSetup
      />
      <SQSConfigFields
        form={form}
        fields={{
          queue_url: 'queue_url',
          region: 'region',
          access_key: 'access_key',
          secret_key: 'secret_key',
          message_group_id: 'message_group_id',
          s3_bucket: 's3_bucket',
        }}
        disabled={disabled}
      />
      <ProjectConfigFields
        form={form}
        fields={{
          enroll_new_projects: 'enroll_new_projects',
          project_ids: 'project_ids',
        }}
        disabled={disabled}
        projectOptions={projectOptions}
      />
      <Flex justify="end" padding="lg">
        <form.SubmitButton disabled={disabled}>{t('Complete Setup')}</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}

export function SQSEditForm({
  dataForwarder,
  projects,
  disabled,
  onSubmit,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
  onSubmit: (payload: DataForwarderPayload) => void;
  projects: Project[];
}) {
  const form = useScrapsForm({
    defaultValues: {
      ...baseFormEditDefaults(dataForwarder),
      ...sqsDefaults,
      ...dataForwarder.config,
    },
    validators: [{run: sqsSchema, triggers: ['change']}],
    onSubmit: ({value}) => {
      const {is_enabled, enroll_new_projects, project_ids, ...configFields} = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SQS,
        config: buildSqsConfig(configFields),
        is_enabled,
        enroll_new_projects,
        project_ids,
      } satisfies DataForwarderPayload);
    },
  });

  const projectOptions = buildProjectOptions(projects);

  return (
    <ScrapsForm form={form}>
      <EnablementFields
        form={form}
        fields={{is_enabled: 'is_enabled'}}
        disabled={disabled}
        isSetup={false}
      />
      <SQSConfigFields
        form={form}
        fields={{
          queue_url: 'queue_url',
          region: 'region',
          access_key: 'access_key',
          secret_key: 'secret_key',
          message_group_id: 'message_group_id',
          s3_bucket: 's3_bucket',
        }}
        disabled={disabled}
      />
      <ProjectConfigFields
        form={form}
        fields={{
          enroll_new_projects: 'enroll_new_projects',
          project_ids: 'project_ids',
        }}
        disabled={disabled}
        projectOptions={projectOptions}
      />
      <Flex justify="end" gap="md" padding="lg 0">
        <DataForwarderDeleteConfirm dataForwarder={dataForwarder}>
          <Button icon={<IconDelete variant="danger" />}>
            {t('Delete Data Forwarder')}
          </Button>
        </DataForwarderDeleteConfirm>
        <form.SubmitButton disabled={disabled}>{t('Update Forwarder')}</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}
