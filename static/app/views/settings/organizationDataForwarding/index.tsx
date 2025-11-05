import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Hovercard} from 'sentry/components/hovercard';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getDataForwarderFormGroups} from 'sentry/views/settings/organizationDataForwarding/forms';
import {useHasDataForwardingAccess} from 'sentry/views/settings/organizationDataForwarding/hooks';
import {
  DataForwarderProviderSlug,
  ProviderLabels,
} from 'sentry/views/settings/organizationDataForwarding/types';

export default function OrganizationDataForwarding() {
  const formModel = useMemo(() => new FormModel(), []);
  const organization = useOrganization();
  const {projects} = useProjects({orgId: organization.slug});
  const [provider, setProvider] = useState<DataForwarderProviderSlug>(
    DataForwarderProviderSlug.SEGMENT
  );

  const [combinedFormState, setCombinedFormState] = useState<
    Record<DataForwarderProviderSlug, Record<string, any>>
  >({
    [DataForwarderProviderSlug.SEGMENT]: {},
    [DataForwarderProviderSlug.SQS]: {},
    [DataForwarderProviderSlug.SPLUNK]: {},
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
      formModel.setFormOptions({
        onFieldChange: updateCombinedFormState,
      });
      formModel.validateFormCompletion();
    },
    // We don't want to re-run every time the combined state changes, only the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, formModel, updateCombinedFormState]
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
          <DataForwardingSetupButton />
        </Flex>
        <Tabs value={provider} onChange={setProvider}>
          <TabList variant="floating">
            {Object.entries(ProviderLabels).map(([key, label]) => (
              <TabList.Item key={key}>
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
        <Form model={formModel}>
          <JsonForm forms={getDataForwarderFormGroups({provider, projects})} />
        </Form>
      </Flex>
    </Fragment>
  );
}

function DataForwardingSetupButton() {
  const hasAccess = useHasDataForwardingAccess();
  return hasAccess ? (
    <Button priority="primary">{t('Start Setup')}</Button>
  ) : (
    <Hovercard
      body={
        <FeatureDisabled
          features={['data-forwarding-revamp-access', 'data-forwarding']}
          featureName={t('Data Forwarding')}
          hideHelpToggle
        />
      }
    >
      <Button priority="primary" disabled>
        {t('Start Setup')}
      </Button>
    </Hovercard>
  );
}
