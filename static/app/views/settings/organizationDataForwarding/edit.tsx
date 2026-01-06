import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import NotFound from 'sentry/components/errors/notFound';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {DataForwarderDeleteConfirm} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderDeleteConfirm';
import {ProjectOverrideForm} from 'sentry/views/settings/organizationDataForwarding/components/projectOverrideForm';
import {getDataForwarderFormGroups} from 'sentry/views/settings/organizationDataForwarding/util/forms';
import {
  useDataForwarders,
  useMutateDataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {
  DATA_FORWARDING_FEATURES,
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
  const theme = useTheme();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projects} = useProjects({orgId: organization.slug});
  const formModel = useMemo(() => new FormModel(), []);
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

  // XXX: This has no reason to be nested since we prohibit updating the provider, but keeping it
  // to match the `setup` form for simplicity when modifying both.
  const [combinedFormState, setCombinedFormState] = useState<
    Record<string, Record<string, any>>
  >({
    [provider]: {
      is_enabled: dataForwarder.isEnabled,
      enroll_new_projects: dataForwarder.enrollNewProjects,
      project_ids: dataForwarder.enrolledProjects.map(project => project.id),
      ...dataForwarder.config,
    },
  });

  const updateCombinedFormState = useCallback(
    (id: string, finalValue: any) => {
      setCombinedFormState(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          [id]: finalValue,
        },
      }));
    },
    [provider]
  );

  useEffect(
    () => {
      formModel.setInitialData({...combinedFormState[provider]});
      formModel.setFormOptions({onFieldChange: updateCombinedFormState});
      formModel.validateFormCompletion();
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, formModel, updateCombinedFormState]
  );

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
              <Form
                submitDisabled={!hasFeature}
                model={formModel}
                onSubmit={data => {
                  const {
                    enroll_new_projects,
                    project_ids = [],
                    is_enabled,
                    ...config
                  } = data;
                  const dataForwardingPayload: Record<string, any> = {
                    provider,
                    config,
                    is_enabled,
                    enroll_new_projects,
                    project_ids,
                  };
                  updateDataForwarder({
                    ...dataForwarder,
                    ...dataForwardingPayload,
                  });
                }}
                extraButton={
                  <DataForwarderDeleteConfirm dataForwarder={dataForwarder}>
                    <Button icon={<IconDelete variant="danger" />}>
                      {t('Delete Data Forwarder')}
                    </Button>
                  </DataForwarderDeleteConfirm>
                }
                submitLabel={t('Update Forwarder')}
                footerStyle={{
                  borderTop: 0,
                  borderBottom: `1px solid ${theme.border}`,
                  marginTop: `-${theme.space.lg}`,
                  paddingBottom: theme.space['3xl'],
                }}
              >
                <JsonForm
                  disabled={!hasFeature}
                  forms={getDataForwarderFormGroups({
                    provider,
                    projects,
                    dataForwarder,
                  })}
                />
              </Form>
              <Flex align="center" justify="between" gap="2xl">
                <Flex direction="column" gap="sm">
                  <Flex align="center" gap="lg">
                    <Heading as="h2" size="2xl">
                      {t('Manage your overrides')}
                    </Heading>
                  </Flex>
                  <Text variant="muted">
                    {t(
                      'These configurations apply to individual projects under your %s forwarder.',
                      ProviderLabels[provider]
                    )}
                  </Text>
                </Flex>
              </Flex>
              <Stack gap="xl">
                {dataForwarder.enrolledProjects.map(project => (
                  <ProjectOverrideForm
                    key={project.id}
                    project={project}
                    dataForwarder={dataForwarder}
                    disabled={!hasFeature}
                  />
                ))}
              </Stack>
            </Fragment>
          )}
        </Feature>
      </Flex>
    </Fragment>
  );
}
