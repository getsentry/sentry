import {Fragment} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {dataForwarderOverrideSchema} from 'sentry/views/settings/organizationDataForwarding/util/forms';
import {useMutateDataForwarderProject} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {
  DataForwarderProviderSlug,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

const PROVIDER_OVERRIDE_FIELDS: Record<DataForwarderProviderSlug, string[]> = {
  [DataForwarderProviderSlug.SQS]: [
    'queue_url',
    'region',
    'access_key',
    'secret_key',
    'message_group_id',
    's3_bucket',
  ],
  [DataForwarderProviderSlug.SEGMENT]: ['write_key'],
  [DataForwarderProviderSlug.SPLUNK]: ['instance_url', 'token', 'index', 'source'],
};

export function ProjectOverrideForm({
  project,
  dataForwarder,
  disabled,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
  project: AvatarProject;
}) {
  const organization = useOrganization();
  const {mutate: updateDataForwarder} = useMutateDataForwarderProject({
    params: {
      orgSlug: organization.slug,
      dataForwarderId: dataForwarder.id,
      project,
    },
    onSuccess: () => {
      trackAnalytics('data_forwarding.edit_override_complete', {
        organization,
        platform: project.platform,
        provider: dataForwarder.provider,
      });
    },
  });

  const projectConfig = dataForwarder.projectConfigs.find(
    config => config.project.id === project.id
  );
  const hasOverrides =
    projectConfig?.overrides && Object.keys(projectConfig.overrides).length > 0;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      is_enabled: projectConfig?.isEnabled ?? false,
      queue_url: '',
      region: '',
      access_key: '',
      secret_key: '',
      message_group_id: '',
      s3_bucket: '',
      write_key: '',
      instance_url: '',
      token: '',
      index: '',
      source: '',
      ...projectConfig?.overrides,
    },
    validators: {onDynamic: dataForwarderOverrideSchema},
    onSubmit: ({value}) => {
      const {is_enabled, ...allOverrides} = value;
      // Only include non-empty overrides for the current provider to avoid
      // empty strings overwriting valid global config values on the backend.
      const providerFields = PROVIDER_OVERRIDE_FIELDS[dataForwarder.provider];
      const overrides: Record<string, string> = {};
      for (const key of providerFields) {
        if (allOverrides[key]) {
          overrides[key] = allOverrides[key];
        }
      }
      updateDataForwarder({
        project_id: `${project.id}`,
        overrides,
        is_enabled,
      });
    },
  });

  const {provider} = dataForwarder;

  const statusTag =
    !disabled &&
    (projectConfig?.isEnabled ? (
      <Tag variant={hasOverrides ? 'warning' : 'success'}>
        {hasOverrides ? t('Forwarding with Overrides') : t('Forwarding')}
      </Tag>
    ) : (
      <Tag variant="danger">{t('Disabled')}</Tag>
    ));

  return (
    <Disclosure>
      <Disclosure.Title trailingItems={statusTag}>
        <Flex align="center" gap="md">
          <ProjectAvatar project={project} size={16} />
          <Text>{project.slug}</Text>
        </Flex>
      </Disclosure.Title>
      <Disclosure.Content>
        <Flex direction="column" borderTop="primary">
          <form.AppForm>
            <form.FormWrapper>
              <form.AppField name="is_enabled">
                {field => (
                  <field.Layout.Row
                    padding="md"
                    label={t('Enable forwarding')}
                    hintText={t('Control forwarding for this project.')}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={disabled}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>

              {provider === DataForwarderProviderSlug.SQS && (
                <Fragment>
                  <form.AppField name="queue_url">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Queue URL')}
                        hintText={t('The URL of the SQS queue to forward events to.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. https://sqs.us-east-1.amazonaws.com/12345678/myqueue"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="region">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Region')}
                        hintText={t('The region of the SQS queue to forward events to.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. us-east-1"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="access_key">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Access Key')}
                        hintText={t(
                          'Currently only long-term IAM access keys are supported.'
                        )}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="secret_key">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Secret Key')}
                        hintText={t('Only visible once when the access key is created.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. wJalrXUtnFEMI1K7MDENGSbPxRfiCYEXAMPLEKEY"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="message_group_id">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Message Group ID')}
                        hintText={t(
                          'Required for FIFO queues, exclude for standard queues'
                        )}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. my-message-group-id"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="s3_bucket">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('S3 Bucket')}
                        hintText={t(
                          'Specify a bucket to store events in S3. The SQS message will contain a reference to the payload location in S3. If no S3 bucket is provided, events over the SQS limit of 256KB will not be forwarded.'
                        )}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. my-s3-bucket"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                </Fragment>
              )}

              {provider === DataForwarderProviderSlug.SEGMENT && (
                <form.AppField name="write_key">
                  {field => (
                    <field.Layout.Row
                      padding="md"
                      label={t('Write Key')}
                      hintText={t(
                        'Add an HTTP API Source to your Segment workspace to generate a write key.'
                      )}
                    >
                      <field.Input
                        value={field.state.value}
                        onChange={field.handleChange}
                        placeholder="e.g. itA5bLOPNxccvZ9ON1NYg9EXAMPLEKEY"
                        disabled={disabled}
                      />
                    </field.Layout.Row>
                  )}
                </form.AppField>
              )}

              {provider === DataForwarderProviderSlug.SPLUNK && (
                <Fragment>
                  <form.AppField name="instance_url">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Instance URL')}
                        hintText={t(
                          'The HTTP Event Collector endpoint for your Splunk instance. Ensure indexer acknowledgement is disabled.'
                        )}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. https://input-foo.cloud.splunk.com:8088"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="token">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Token')}
                        hintText={t('The token generated for your HTTP Event Collector.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. ab13cdef-45aa-1bcd-a123-bcEXAMPLEKEY"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="index">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Index')}
                        hintText={t('The index to use for the events.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. main"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                  <form.AppField name="source">
                    {field => (
                      <field.Layout.Row
                        padding="md"
                        label={t('Source')}
                        hintText={t('The source to use for the events.')}
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. sentry"
                          disabled={disabled}
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                </Fragment>
              )}

              <Flex justify="end" gap="md" padding="lg 0">
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    updateDataForwarder({
                      project_id: `${project.id}`,
                      overrides: {},
                      is_enabled: projectConfig?.isEnabled ?? false,
                    });
                  }}
                >
                  {t('Clear Override')}
                </Button>
                <form.SubmitButton size="sm" disabled={disabled}>
                  {t('Save Override')}
                </form.SubmitButton>
              </Flex>
            </form.FormWrapper>
          </form.AppForm>
        </Flex>
      </Disclosure.Content>
    </Disclosure>
  );
}
