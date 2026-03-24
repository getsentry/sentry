import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ProjectOverrideForm} from 'sentry/views/settings/organizationDataForwarding/components/projectOverrideForm';
import {
  useDataForwarders,
  useMutateDataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {SegmentEditForm} from 'sentry/views/settings/organizationDataForwarding/util/segmentForm';
import {SplunkEditForm} from 'sentry/views/settings/organizationDataForwarding/util/splunkForm';
import {SQSEditForm} from 'sentry/views/settings/organizationDataForwarding/util/sqsForm';
import {
  DATA_FORWARDING_FEATURES,
  DataForwarderProviderSlug,
  ProviderLabels,
  type DataForwarder,
  type DataForwarderPayload,
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
              trackAnalytics('data_forwarding.back_button_clicked', {
                organization,
              });
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
              <ProviderEditForm
                dataForwarder={dataForwarder}
                projects={projects}
                disabled={!hasFeature}
              />
              {dataForwarder.enrolledProjects.length > 0 && (
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
              )}
            </Fragment>
          )}
        </Feature>
      </Flex>
    </Fragment>
  );
}

function ProviderEditForm({
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

  const handleSubmit = (payload: DataForwarderPayload) => updateDataForwarder(payload);

  switch (provider) {
    case DataForwarderProviderSlug.SQS:
      return (
        <SQSEditForm
          dataForwarder={dataForwarder}
          projects={projects}
          disabled={disabled}
          onSubmit={handleSubmit}
        />
      );
    case DataForwarderProviderSlug.SEGMENT:
      return (
        <SegmentEditForm
          dataForwarder={dataForwarder}
          projects={projects}
          disabled={disabled}
          onSubmit={handleSubmit}
        />
      );
    case DataForwarderProviderSlug.SPLUNK:
      return (
        <SplunkEditForm
          dataForwarder={dataForwarder}
          projects={projects}
          disabled={disabled}
          onSubmit={handleSubmit}
        />
      );
    default:
      return null;
  }
}
