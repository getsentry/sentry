import {Fragment, useMemo, useRef, useState} from 'react';
import {z} from 'zod';

import {AlertLink} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import IdBadge from 'sentry/components/idBadge';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
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

export default function OrganizationDataForwardingSetup() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {data: dataForwarders = []} = useDataForwarders({
    params: {orgSlug: organization.slug},
  });
  const canCreateForwarder =
    dataForwarders.length < Object.values(DataForwarderProviderSlug).length;

  const disabledProviders = useMemo(
    () => new Set(dataForwarders.map(df => df.provider)),
    [dataForwarders]
  );

  const {projects} = useProjects({orgId: organization.slug});
  const [provider, setProvider] = useState<DataForwarderProviderSlug | undefined>(
    undefined
  );
  const {mutate: createDataForwarder} = useMutateDataForwarder({
    params: {orgSlug: organization.slug},
    onSuccess: df => {
      navigate(`/settings/${organization.slug}/data-forwarding/`);
      trackAnalytics('data_forwarding.setup_complete', {
        organization,
        provider,
        are_new_projects_enrolled: df?.enrollNewProjects ?? false,
        project_count: df?.enrolledProjects?.length ?? 0,
      });
    },
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Setup Data Forwarding')} />
      <Flex direction="column" gap="lg">
        <Flex align="center" justify="between" gap="2xl">
          <Flex direction="column" gap="sm">
            <Flex align="center" gap="lg">
              <Heading as="h1">{t('Setup Data Forwarding')}</Heading>
            </Flex>
            <Text variant="muted">
              {t('Configure the global settings for your data forwarder.')}
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
              {!canCreateForwarder && (
                <AlertLink
                  variant="warning"
                  to={`/settings/${organization.slug}/data-forwarding/`}
                >
                  {t(
                    'Cannot create any more forwarders, manage your existing ones instead.'
                  )}
                </AlertLink>
              )}
              {!hasFeature && (
                <FeatureDisabled
                  alert
                  featureName={t('Data Forwarding')}
                  features={features}
                />
              )}
              <Tabs value={provider} onChange={setProvider} disableOverflow>
                <TabList variant="floating">
                  {Object.entries(ProviderLabels).map(([key, label]) => (
                    <TabList.Item
                      key={key}
                      disabled={
                        disabledProviders.has(key as DataForwarderProviderSlug) ||
                        !hasFeature
                      }
                      tooltip={
                        disabledProviders.has(key as DataForwarderProviderSlug)
                          ? {title: t('Only one configuration is allowed per provider.')}
                          : undefined
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
              {provider && (
                <DataForwarderSetupForm
                  key={provider}
                  provider={provider}
                  projects={projects}
                  disabled={!canCreateForwarder || !hasFeature}
                  onCreate={createDataForwarder}
                />
              )}
            </Fragment>
          )}
        </Feature>
      </Flex>
    </Fragment>
  );
}

function DataForwarderSetupForm({
  provider,
  projects,
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (data: DataForwarder) => void;
  projects: Project[];
  provider: DataForwarderProviderSlug;
}) {
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const schema = useMemo(
    () =>
      dataForwarderFormSchema.superRefine((data, ctx) => {
        const p = providerRef.current;
        if (p === DataForwarderProviderSlug.SQS) {
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
        } else if (p === DataForwarderProviderSlug.SEGMENT) {
          if (!data.write_key?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['write_key'],
              message: t('Write key is required'),
            });
          }
        } else if (p === DataForwarderProviderSlug.SPLUNK) {
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
    []
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      is_enabled: true,
      enroll_new_projects: false,
      project_ids: [] as string[],
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
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {is_enabled, enroll_new_projects, project_ids = [], ...allFields} = value;
      const p = providerRef.current;

      let config: Record<string, string | undefined>;
      if (p === DataForwarderProviderSlug.SQS) {
        config = {
          queue_url: allFields.queue_url,
          region: allFields.region,
          access_key: allFields.access_key,
          secret_key: allFields.secret_key,
          message_group_id: allFields.message_group_id || undefined,
          s3_bucket: allFields.s3_bucket || undefined,
        };
      } else if (p === DataForwarderProviderSlug.SEGMENT) {
        config = {write_key: allFields.write_key};
      } else {
        config = {
          instance_url: allFields.instance_url,
          token: allFields.token,
          index: allFields.index,
          source: allFields.source,
        };
      }

      onCreate({
        provider: p,
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
                hintText={t('Will be enabled after the initial setup is complete.')}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled
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

        <Flex justify="end" padding="lg">
          <form.SubmitButton disabled={disabled}>{t('Complete Setup')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}
