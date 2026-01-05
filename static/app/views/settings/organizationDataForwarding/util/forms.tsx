import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge/tag';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {AvatarProject, Project} from 'sentry/types/project';
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
  return [
    getEnablementForm({dataForwarder}),
    ...getProviderForm({provider}),
    getProjectConfigurationForm({projects}),
  ];
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

function getEnablementForm({
  dataForwarder,
}: {
  dataForwarder?: DataForwarder;
}): JsonFormObject {
  const hasCompleteSetup = dataForwarder;
  return {
    title: t('Enablement'),
    fields: [
      {
        name: 'is_enabled',
        label: t('Enable data forwarding'),
        type: 'boolean',
        defaultValue: dataForwarder?.isEnabled ?? true,
        // Need to set 'undefined' instead of false so that the field can still be disabled by the form
        disabled: hasCompleteSetup ? undefined : true,
        help: hasCompleteSetup
          ? t('Will override all projects to shut-off data forwarding altogether.')
          : t('Will be enabled after the initial setup is complete.'),
      },
    ],
  };
}

function getProjectConfigurationForm({projects}: {projects: Project[]}): JsonFormObject {
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
        required: false,
        defaultValue: [],
        help: 'Select the projects which should forward their data.',
        options: projectOptions,
      },
    ],
  };
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
