import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';

import {AlertLink} from '@sentry/scraps/alert/alertLink';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getDataForwarderFormGroups} from 'sentry/views/settings/organizationDataForwarding/util/forms';
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
  const formModel = useMemo(() => new FormModel(), []);
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

  const [combinedFormState, setCombinedFormState] = useState<
    Record<DataForwarderProviderSlug, Record<string, any>>
  >({
    [DataForwarderProviderSlug.SEGMENT]: {},
    [DataForwarderProviderSlug.SQS]: {},
    [DataForwarderProviderSlug.SPLUNK]: {},
  });

  const updateCombinedFormState = useCallback(
    (id: string, finalValue: any) => {
      if (!provider) {
        return;
      }
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
      formModel.setInitialData(provider ? {...combinedFormState[provider]} : undefined);
      formModel.setFormOptions({onFieldChange: updateCombinedFormState});
      formModel.validateFormCompletion();
    },
    // We don't want to re-run every time the combined state changes, only the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, formModel, updateCombinedFormState]
  );

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
              <Form
                submitDisabled={!canCreateForwarder || !hasFeature}
                model={formModel}
                onSubmit={data => {
                  const {enroll_new_projects, project_ids, is_enabled, ...config} = data;
                  const dataForwardingPayload: Record<string, any> = {
                    provider,
                    config,
                    is_enabled,
                    enroll_new_projects,
                    project_ids,
                  };
                  createDataForwarder(dataForwardingPayload as DataForwarder);
                }}
                submitLabel={t('Complete Setup')}
              >
                <JsonForm
                  disabled={!canCreateForwarder || !hasFeature}
                  forms={getDataForwarderFormGroups({
                    provider,
                    projects,
                  })}
                />
              </Form>
            </Fragment>
          )}
        </Feature>
      </Flex>
    </Fragment>
  );
}
