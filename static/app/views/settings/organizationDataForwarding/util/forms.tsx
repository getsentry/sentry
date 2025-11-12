import type {JsonFormObject} from 'sentry/components/forms/types';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {
  DataForwarderProviderSlug,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function getDataForwarderFormGroups({
  provider,
  dataForwarder,
  projects,
}: {
  projects: Project[];
  dataForwarder?: DataForwarder;
  provider?: DataForwarderProviderSlug;
}): JsonFormObject[] {
  let providerFormGroups: JsonFormObject[] = [];
  switch (provider) {
    case DataForwarderProviderSlug.SQS:
      providerFormGroups = [SQS_GLOBAL_CONFIGURATION_FORM];
      break;
    case DataForwarderProviderSlug.SEGMENT:
      providerFormGroups = [SEGMENT_GLOBAL_CONFIGURATION_FORM];
      break;
    case DataForwarderProviderSlug.SPLUNK:
      providerFormGroups = [SPLUNK_GLOBAL_CONFIGURATION_FORM];
      break;
    default:
      providerFormGroups = [];
  }
  return [
    getEnablementForm({dataForwarder}),
    ...providerFormGroups,
    getProjectConfigurationForm(projects),
  ];
}

const getEnablementForm = ({
  dataForwarder,
}: {
  dataForwarder?: DataForwarder;
}): JsonFormObject => {
  const hasCompleteSetup = dataForwarder;

  return {
    title: t('Enablement'),
    fields: [
      {
        name: 'is_enabled',
        label: t('Enable data forwarding'),
        type: 'boolean',
        defaultValue: false,
        help: hasCompleteSetup
          ? t('Will override everything to shut-off data forwarding.')
          : t('Will be disabled until the initial setup is complete.'),
        disabled: !hasCompleteSetup,
      },
    ],
  };
};

function getProjectConfigurationForm(projects: Project[]): JsonFormObject {
  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.slug,
    leadingItems: <IdBadge project={project} avatarSize={16} disableLink hideName />,
  }));
  return {
    title: t('Project Configuration'),
    fields: [
      {
        name: 'enroll_new_projects',
        label: 'Auto-enroll new projects',
        type: 'boolean',
        help: 'Should new projects automatically forward their data?',
      },
      {
        name: 'project_ids',
        label: 'Forwarding projects',
        type: 'select',
        multiple: true,
        defaultValue: [],
        help: 'Select the projects which should forward their data.',
        options: projectOptions,
      },
    ],
  };
}

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
      help: 'Only visible once when the access key is created..',
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
      placeholder: 'e.g. 1234567890abcdef1234567890abcdef',
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
