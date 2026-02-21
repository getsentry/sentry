import {Fragment, useMemo} from 'react';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, FieldGroup, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import NotFound from 'sentry/components/errors/notFound';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {DataForwarderDeleteConfirm} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderDeleteConfirm';
import {ProjectOverrideForm} from 'sentry/views/settings/organizationDataForwarding/components/projectOverrideForm';
import {
  dataForwarderFormSchema,
} from 'sentry/views/settings/organizationDataForwarding/util/forms';
import {
  useDataForwarders,
  useMutateDataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {
  DATA_FORWARDING_FEATURES,
  DataForwarderProviderSlug,
  ProviderLabels,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export default function OrganizationDataForwardingEditWrapper() {
  const organization = useOrganization();
  const {dataForwarderId} = useParams();
  const {data: dataForwarders, isLoading} = useDataForwarders({
    params: {orgSlug: organization.slug},
  });
  const dataForwarder = dataForwarders?.find(df => df.id === dataForwarderId);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!dataForwarder) {
    return <NotFound />;
  }

  return <OrganizationDataForwardingEdit dataForwarder={dataForwarder} />;
}

function OrganizationDataForwardingEdit({dataForwarder}: {dataForwarder: DataForwarder}) {
  const {provider} = dataForwarder;
  const organization = useOrganization();
  const {projects} = useProjects({orgId: organization.slug});

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Edit your %s forwarder', ProviderLabels[provider])}
      />
      <Flex direction="column" gap="lg">
        <Flex align="center" justify="between" gap="2xl">
          <Flex direction="column" gap="sm">
            <Flex align="center" gap="lg">
              <Heading as="h1">{t('Edit your forwarder')}</Heading>
            </Flex>
            <Text variant="muted">
              {t(
                'Modify the configuration for your %s forwarder.',
                ProviderLabels[provider]
              )}
            </Text>
          </Flex>
          <LinkButton
            size="sm"
            to={`/settings/${organization.slug}/data-forwarding/`}
            icon={<IconArrow direction="left" />}
            onClick={() => {
              trackAnalytics('data_forwarding.back_button_clicked', {organization});
            }}
          >
            {t('Back')}
          </LinkButton>
        </Flex>
        <Feature
          features={DATA_FORWARDING_FEATURES}
          hookName="feature-disabled:data-forwarding"
        >
          {({hasFeature, features}) => (
            <Fragment>
              {!hasFeature && (
                <FeatureDisabled
                  alert
                  featureName={t('Data Forwarding')}
                  features={features}
                  message={t(
                    'This feature is currently disabled, data will not be forwarded.'
                  )}
                />
              )}
              <Tabs value={dataForwarder.provider} disableOverflow>
                <TabList variant="floating">
                  {Object.entries(ProviderLabels).map(([key, label]) => (
                    <TabList.Item
                      key={key}
                      disabled={key !== provider || !hasFeature}
                      tooltip={
                        key === provider
                          ? undefined
                          : {
                              title: t(
                                'Cannot update provider after setup, create a new forwarder instead.'
                              ),
                            }
                      }
                    >
                      <Flex align="center" gap="sm">
                        <PluginIcon pluginId={key} />
                        <b>{label}</b>
                      </Flex>
                    </TabList.Item>
                  ))}
                </TabList>
              </Tabs>
              <DataForwarderEditForm
                dataForwarder={dataForwarder}
                projects={projects}
                disabled={!hasFeature}
              />
              <FieldGroup title={t('Project Overrides')}>
                {dataForwarder.enrolledProjects.map(project => (
                  <ProjectOverrideForm
                    key={project.id}
                    project={project}
                    dataForwarder={dataForwarder}
                    disabled={!hasFeature}
                  />
                ))}
              </FieldGroup>
            </Fragment>
          )}
        </Feature>
      </Flex>
    </Fragment>
  );
}

function DataForwarderEditForm({
  dataForwarder,
  projects,
  disabled,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
  projects: Project[];
}) {
  const {provider} = dataForwarder;
  const navigate = useNavigate();
  const organization = useOrganization();
  const {mutate: updateDataForwarder} = useMutateDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder.id},
    onSuccess: df => {
      navigate(`/settings/${organization.slug}/data-forwarding/`);
      trackAnalytics('data_forwarding.edit_complete', {
        organization,
        provider,
        are_new_projects_enrolled: df?.enrollNewProjects ?? false,
        new_project_count: df?.enrolledProjects?.length ?? 0,
        old_project_count: dataForwarder.enrolledProjects.length,
      });
    },
  });

  const schema = useMemo(
    () =>
      dataForwarderFormSchema.superRefine((data, ctx) => {
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
      }),
    [provider]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      is_enabled: dataForwarder.isEnabled,
      enroll_new_projects: dataForwarder.enrollNewProjects,
      project_ids: dataForwarder.enrolledProjects.map(p => p.id),
      queue_url: '',
      region: '',
      access_key: '',
      secret_key: '',
      message_group_id: '',
      s3_bucket: '',
      write_key: '',
      instance_url: '',
      token: '',
      index: 'main',
      source: 'sentry',
      ...dataForwarder.config,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {is_enabled, enroll_new_projects, project_ids = [], ...allFields} = value;

      let config: Record<string, string | undefined>;
      if (provider === DataForwarderProviderSlug.SQS) {
        config = {
          queue_url: allFields.queue_url,
          region: allFields.region,
          access_key: allFields.access_key,
          secret_key: allFields.secret_key,
          message_group_id: allFields.message_group_id || undefined,
          s3_bucket: allFields.s3_bucket || undefined,
        };
      } else if (provider === DataForwarderProviderSlug.SEGMENT) {
        config = {write_key: allFields.write_key};
      } else {
        config = {
          instance_url: allFields.instance_url,
          token: allFields.token,
          index: allFields.index,
          source: allFields.source,
        };
      }

      updateDataForwarder({
        ...dataForwarder,
        provider,
        config,
        is_enabled,
        enroll_new_projects,
        project_ids,
      } as unknown as DataForwarder);
    },
  });

  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.slug,
    leadingItems: <IdBadge project={project} avatarSize={16} disableLink hideName />,
  }));

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.FieldGroup title={t('Enablement')}>
          <form.AppField name="is_enabled">
            {field => (
              <field.Layout.Row
                label={t('Enable data forwarding')}
                hintText={t(
                  'Will override all projects to shut-off data forwarding altogether.'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        {provider === DataForwarderProviderSlug.SQS && (
          <form.FieldGroup title={t('Global Configuration')}>
            <form.AppField name="queue_url">
              {field => (
                <field.Layout.Row
                  label={t('Queue URL')}
                  hintText={t('The URL of the SQS queue to forward events to.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Region')}
                  hintText={t('The region of the SQS queue to forward events to.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Access Key')}
                  hintText={t('Currently only long-term IAM access keys are supported.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Secret Key')}
                  hintText={t('Only visible once when the access key is created.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Message Group ID')}
                  hintText={t('Required for FIFO queues, exclude for standard queues')}
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('S3 Bucket')}
                  hintText={t(
                    'Specify a bucket to store events in S3. The SQS message will contain a reference to the payload location in S3. If no S3 bucket is provided, events over the SQS limit of 256KB will not be forwarded.'
                  )}
                >
                  <field.Input
                    value={field.state.value ?? ''}
                    onChange={field.handleChange}
                    placeholder="e.g. my-s3-bucket"
                    disabled={disabled}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </form.FieldGroup>
        )}

        {provider === DataForwarderProviderSlug.SEGMENT && (
          <form.FieldGroup title={t('Global Configuration')}>
            <form.AppField name="write_key">
              {field => (
                <field.Layout.Row
                  label={t('Write Key')}
                  hintText={t(
                    'Add an HTTP API Source to your Segment workspace to generate a write key.'
                  )}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
                    onChange={field.handleChange}
                    placeholder="e.g. itA5bLOPNxccvZ9ON1NYg9EXAMPLEKEY"
                    disabled={disabled}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </form.FieldGroup>
        )}

        {provider === DataForwarderProviderSlug.SPLUNK && (
          <form.FieldGroup title={t('Global Configuration')}>
            <form.AppField name="instance_url">
              {field => (
                <field.Layout.Row
                  label={t('Instance URL')}
                  hintText={t(
                    'The HTTP Event Collector endpoint for your Splunk instance. Ensure indexer acknowledgement is disabled.'
                  )}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Token')}
                  hintText={t('The token generated for your HTTP Event Collector.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Index')}
                  hintText={t('The index to use for the events.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
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
                  label={t('Source')}
                  hintText={t('The source to use for the events.')}
                  required
                >
                  <field.Input
                    value={field.state.value ?? ''}
                    onChange={field.handleChange}
                    placeholder="e.g. sentry"
                    disabled={disabled}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </form.FieldGroup>
        )}

        <form.FieldGroup title={t('Project Configuration')}>
          <form.AppField name="enroll_new_projects">
            {field => (
              <field.Layout.Row
                label={t('Auto-enroll new projects')}
                hintText={t('Should new projects automatically forward their data?')}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="project_ids">
            {field => (
              <field.Layout.Row
                label={t('Forwarding projects')}
                hintText={t('Select the projects which should forward their data.')}
              >
                <field.Select
                  multiple
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={projectOptions}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex justify="end" gap="md" padding="lg 0">
          <DataForwarderDeleteConfirm dataForwarder={dataForwarder}>
            <Button icon={<IconDelete variant="danger" />}>
              {t('Delete Data Forwarder')}
            </Button>
          </DataForwarderDeleteConfirm>
          <form.SubmitButton disabled={disabled}>{t('Update Forwarder')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}
