import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getDataForwarderFormGroups} from 'sentry/views/settings/organizationDataForwarding/forms';
import {
  useDataForwarder,
  useDeleteDataForwarder,
  useMutateDataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/hooks';
import {
  DataForwarderProviderSlug,
  ProviderLabels,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/types';

const initialCombinedState = {
  [DataForwarderProviderSlug.SEGMENT]: {},
  [DataForwarderProviderSlug.SQS]: {},
  [DataForwarderProviderSlug.SPLUNK]: {},
};

export default function OrganizationDataForwarding() {
  const formModel = useMemo(() => new FormModel(), []);
  const organization = useOrganization();
  const {projects} = useProjects({orgId: organization.slug});
  const [provider, setProvider] = useState<DataForwarderProviderSlug>(
    DataForwarderProviderSlug.SEGMENT
  );

  const dataForwarder = useDataForwarder({orgSlug: organization.slug});
  const {mutate: mutateDataForwarder} = useMutateDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder?.id},
  });

  const [combinedFormState, setCombinedFormState] =
    useState<Record<DataForwarderProviderSlug, Record<string, any>>>(
      initialCombinedState
    );

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
      if (!dataForwarder) {
        return;
      }
      const initialData: Record<string, any> = {
        is_enabled: dataForwarder.isEnabled,
        enroll_new_projects: dataForwarder.enrollNewProjects,
        project_ids: dataForwarder.enrolledProjects.map(project => project.id),
        ...dataForwarder.config,
      };
      setCombinedFormState(prev => ({...prev, [dataForwarder.provider]: initialData}));
      formModel.setInitialData(
        dataForwarder ? initialData : {...combinedFormState[provider]}
      );
      formModel.setFormOptions({onFieldChange: updateCombinedFormState});
      formModel.validateFormCompletion();
    },
    // We don't want to re-run every time the combined state changes, only the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, formModel, updateCombinedFormState, dataForwarder]
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Data Forwarding')} />
      <Flex direction="column" gap="lg">
        <Flex align="center" justify="between" gap="2xl">
          <Flex direction="column" gap="sm">
            <Flex align="center" gap="lg">
              <Heading as="h1">{t('Data Forwarding')}</Heading>
              <FeatureBadge type="beta" />
            </Flex>
            <Text variant="muted">
              {tct(
                'Pipe your Sentry error events into other business intelligence tools. Learn more about this feature in our [link:docs].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/organization/integrations/data-forwarding/" />
                  ),
                }
              )}
            </Text>
          </Flex>
        </Flex>
        <Tabs
          value={dataForwarder ? dataForwarder.provider : provider}
          onChange={dataForwarder ? undefined : setProvider}
        >
          <TabList variant="floating">
            {Object.entries(ProviderLabels).map(([key, label]) => (
              <TabList.Item
                key={key}
                disabled={dataForwarder ? key !== dataForwarder.provider : false}
              >
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={key === DataForwarderProviderSlug.SQS ? 'amazon-sqs' : key}
                  />
                  <b>{label}</b>
                </Flex>
              </TabList.Item>
            ))}
          </TabList>
        </Tabs>
        <Form
          model={formModel}
          onSubmit={data => {
            const {enroll_new_projects, project_ids, is_enabled, ...config} = data;
            const dataForwardingPayload: Record<string, any> = {
              provider: dataForwarder?.provider ?? provider,
              config,
              is_enabled,
              enroll_new_projects,
              project_ids,
            };
            mutateDataForwarder(dataForwardingPayload as DataForwarder);
          }}
          extraButton={
            dataForwarder && <DataForwardingDeleteButton dataForwarder={dataForwarder} />
          }
          submitLabel={dataForwarder ? t('Save Changes') : t('Complete Setup')}
        >
          <JsonForm
            forms={getDataForwarderFormGroups({
              provider: dataForwarder ? dataForwarder.provider : provider,
              projects,
              dataForwarder,
              organization,
            })}
          />
        </Form>
      </Flex>
    </Fragment>
  );
}

function DataForwardingDeleteButton({dataForwarder}: {dataForwarder: DataForwarder}) {
  const organization = useOrganization();
  const {mutate: deleteDataForwarder} = useDeleteDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder?.id},
  });
  return (
    <Button
      icon={<IconDelete color="danger" />}
      onClick={() => {
        deleteDataForwarder({
          dataForwarderId: dataForwarder.id,
          orgSlug: organization.slug,
        });
      }}
    >
      {t('Remove Forwarder')}
    </Button>
  );
}
