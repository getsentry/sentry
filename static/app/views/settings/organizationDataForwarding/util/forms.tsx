import {Fragment} from 'react';
import styled from '@emotion/styled';
import {z} from 'zod';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {
  DataForwarderProviderSlug,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function getCreateTooltip(params: {
  hasAccess: boolean;
  hasAvailability: boolean;
  hasFeature: boolean;
}): string | undefined {
  if (!params.hasFeature) {
    return t('This feature is not available for your organization');
  }
  if (!params.hasAccess) {
    return t(
      'You must be an organization owner, manager or admin to configure data forwarding.'
    );
  }
  if (!params.hasAvailability) {
    return t('Maximum data forwarders configured.');
  }
  return undefined;
}

/**
 * Combined schema for the setup and edit forms. Provider-specific fields are always
 * strings (initialized to '' when unused). Per-provider required-field validation is
 * enforced via superRefine in the consuming component.
 */
export const dataForwarderFormSchema = z.object({
  is_enabled: z.boolean(),
  enroll_new_projects: z.boolean(),
  project_ids: z.array(z.string()),
  // SQS
  queue_url: z.string(),
  region: z.string(),
  access_key: z.string(),
  secret_key: z.string(),
  message_group_id: z.string(),
  s3_bucket: z.string(),
  // Segment
  write_key: z.string(),
  // Splunk
  instance_url: z.string(),
  token: z.string(),
  index: z.string(),
  source: z.string(),
});

/**
 * Builds a provider-specific validation schema by extending the base form schema
 * with required-field checks for the given provider.
 */
export function buildDataForwardingProviderSchema(provider: DataForwarderProviderSlug) {
  return dataForwarderFormSchema.superRefine((data, ctx) => {
    if (provider === DataForwarderProviderSlug.SQS) {
      if (!data.queue_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['queue_url'],
          message: t('Queue URL is required'),
        });
      }
      if (!data.region?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['region'],
          message: t('Region is required'),
        });
      }
      if (!data.access_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['access_key'],
          message: t('Access key is required'),
        });
      }
      if (!data.secret_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secret_key'],
          message: t('Secret key is required'),
        });
      }
    } else if (provider === DataForwarderProviderSlug.SEGMENT) {
      if (!data.write_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['write_key'],
          message: t('Write key is required'),
        });
      }
    } else if (provider === DataForwarderProviderSlug.SPLUNK) {
      if (!data.instance_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['instance_url'],
          message: t('Instance URL is required'),
        });
      }
      if (!data.token?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['token'],
          message: t('Token is required'),
        });
      }
      if (!data.index?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['index'],
          message: t('Index is required'),
        });
      }
      if (!data.source?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source'],
          message: t('Source is required'),
        });
      }
    }
  });
}

type ProviderConfigFields = Pick<
  z.infer<typeof dataForwarderFormSchema>,
  | 'queue_url'
  | 'region'
  | 'access_key'
  | 'secret_key'
  | 'message_group_id'
  | 's3_bucket'
  | 'write_key'
  | 'instance_url'
  | 'token'
  | 'index'
  | 'source'
>;

/**
 * Builds the provider-specific config object from form field values.
 */
export function buildDataForwardingProviderConfig(
  provider: DataForwarderProviderSlug,
  fields: ProviderConfigFields
): Record<string, string | undefined> {
  if (provider === DataForwarderProviderSlug.SQS) {
    return {
      queue_url: fields.queue_url,
      region: fields.region,
      access_key: fields.access_key,
      secret_key: fields.secret_key,
      message_group_id: fields.message_group_id || undefined,
      s3_bucket: fields.s3_bucket || undefined,
    };
  }
  if (provider === DataForwarderProviderSlug.SEGMENT) {
    return {write_key: fields.write_key};
  }
  return {
    instance_url: fields.instance_url,
    token: fields.token,
    index: fields.index,
    source: fields.source,
  };
}

function getProviderForm({
  provider,
}: {
  provider?: DataForwarderProviderSlug;
}): JsonFormObject[] {
  switch (provider) {
    case DataForwarderProviderSlug.SQS:
      return [SQS_GLOBAL_CONFIGURATION_FORM];
    case DataForwarderProviderSlug.SEGMENT:
      return [SEGMENT_GLOBAL_CONFIGURATION_FORM];
    case DataForwarderProviderSlug.SPLUNK:
      return [SPLUNK_GLOBAL_CONFIGURATION_FORM];
    default:
      return [];
  }
}

export function getProjectOverrideForm({
  project,
  dataForwarder,
  omitTag = false,
}: {
  dataForwarder: DataForwarder;
  project: AvatarProject;
  omitTag?: boolean;
}): JsonFormObject {
  const [providerForm] = getProviderForm({provider: dataForwarder.provider});
  const providerFields = providerForm?.fields.map(
    field =>
      ({
        ...field,
        defaultValue: undefined,
        required: false,
      }) as FieldObject
  );
  const projectConfig = dataForwarder.projectConfigs.find(
    config => config.project.id === project.id
  );
  const hasOverrides =
    projectConfig?.overrides && Object.keys(projectConfig?.overrides).length > 0;
  return {
    title: (
      <Flex justify="between" width="100%" paddingRight="lg">
        <Flex align="center" gap="md">
          <ProjectAvatar project={project} size={16} />
          <Text>{project.slug}</Text>
        </Flex>
        {!omitTag && (
          <Fragment>
            {projectConfig?.isEnabled ? (
              <CalmTag variant={hasOverrides ? 'warning' : 'success'}>
                {hasOverrides ? t('Forwarding with Overrides') : t('Forwarding')}
              </CalmTag>
            ) : (
              <CalmTag variant="danger">{t('Disabled')}</CalmTag>
            )}
          </Fragment>
        )}
      </Flex>
    ),
    initiallyCollapsed: true,
    fields: [
      {
        name: 'is_enabled',
        label: t('Enable forwarding'),
        help: t('Control forwarding for this project.'),
        type: 'boolean',
        defaultValue: true,
      },
      ...(providerFields ?? []),
    ],
  };
}

const CalmTag = styled(Tag)`
  /* Need to override the panel header's styles here */
  text-transform: none;
`;

const SQS_GLOBAL_CONFIGURATION_FORM: JsonFormObject = {
  title: t('Global Configuration'),
  fields: [
    {
      name: 'queue_url',
      label: 'Queue URL',
      type: 'text',
      required: true,
      help: 'The URL of the SQS queue to forward events to.',
      placeholder: 'e.g. https://sqs.us-east-1.amazonaws.com/12345678/myqueue',
    },
    {
      name: 'region',
      label: 'Region',
      type: 'text',
      required: true,
      help: 'The region of the SQS queue to forward events to.',
      placeholder: 'e.g. us-east-1',
    },
    {
      name: 'access_key',
      label: 'Access Key',
      type: 'text',
      required: true,
      help: 'Currently only long-term IAM access keys are supported.',
      placeholder: 'e.g. AKIAIOSFODNN7EXAMPLE',
    },
    {
      name: 'secret_key',
      label: 'Secret Key',
      type: 'text',
      required: true,
      help: 'Only visible once when the access key is created.',
      placeholder: 'e.g. wJalrXUtnFEMI1K7MDENGSbPxRfiCYEXAMPLEKEY',
    },
    {
      name: 'message_group_id',
      label: 'Message Group ID',
      type: 'text',
      required: false,
      help: 'Required for FIFO queues, exclude for standard queues',
      placeholder: 'e.g. my-message-group-id',
    },
    {
      name: 's3_bucket',
      label: 'S3 Bucket',
      type: 'text',
      required: false,
      help: 'Specify a bucket to store events in S3. The SQS message will contain a reference to the payload location in S3. If no S3 bucket is provided, events over the SQS limit of 256KB will not be forwarded.',
      placeholder: 'e.g. my-s3-bucket',
    },
  ],
};

const SEGMENT_GLOBAL_CONFIGURATION_FORM: JsonFormObject = {
  title: t('Global Configuration'),
  fields: [
    {
      name: 'write_key',
      label: 'Write Key',
      type: 'text',
      required: true,
      help: 'Add an HTTP API Source to your Segment workspace to generate a write key.',
      placeholder: 'e.g. itA5bLOPNxccvZ9ON1NYg9EXAMPLEKEY',
    },
  ],
};

const SPLUNK_GLOBAL_CONFIGURATION_FORM: JsonFormObject = {
  title: t('Global Configuration'),
  fields: [
    {
      name: 'instance_url',
      label: 'Instance URL',
      type: 'text',
      required: true,
      help: 'The HTTP Event Collector endpoint for your Splunk instance. Ensure indexer acknowledgement is disabled.',
      placeholder: 'e.g. https://input-foo.cloud.splunk.com:8088',
    },
    {
      name: 'token',
      label: 'Token',
      type: 'text',
      required: true,
      help: 'The token generated for your HTTP Event Collector.',
      placeholder: 'e.g. ab13cdef-45aa-1bcd-a123-bcEXAMPLEKEY',
    },
    {
      name: 'index',
      label: 'Index',
      type: 'text',
      required: true,
      defaultValue: 'main',
      placeholder: 'e.g. main',
      help: 'The index to use for the events.',
    },
    {
      name: 'source',
      label: 'Source',
      type: 'text',
      required: true,
      defaultValue: 'sentry',
      placeholder: 'e.g. sentry',
      help: 'The source to use for the events.',
    },
  ],
};
