import {useCallback, useState} from 'react';
import omit from 'lodash/omit';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import type {Relay, RelayActivity} from 'sentry/types/relay';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import Add from './modals/add';
import Edit from './modals/edit';
import EmptyState from './emptyState';
import List from './list';

const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

const relaySchema = z.object({
  ingestThroughTrustedRelaysOnly: z.boolean(),
});

export function RelayWrapper() {
  const organization = useOrganization();
  const api = useApi();
  const [relays, setRelays] = useState<Relay[]>(organization.trustedRelays);

  const disabled = !organization.access.includes('org:write');

  const handleOpenAddDialog = useCallback(() => {
    openModal(modalProps => (
      <Add
        {...modalProps}
        savedRelays={relays}
        api={api}
        orgSlug={organization.slug}
        onSubmitSuccess={response => {
          addSuccessMessage(t('Successfully added Relay public key'));
          setRelays(response.trustedRelays);
        }}
      />
    ));
  }, [relays, api, organization.slug]);

  return (
    <SentryDocumentTitle title={t('Relay')} orgSlug={organization.slug}>
      <SettingsPageHeader
        title={t('Relay')}
        action={
          <Button
            tooltipProps={{
              title: disabled
                ? t('You do not have permission to register keys')
                : undefined,
            }}
            priority="primary"
            size="sm"
            icon={<IconAdd />}
            onClick={handleOpenAddDialog}
            disabled={disabled}
          >
            {t('Register Key')}
          </Button>
        }
      />
      <OrganizationPermissionAlert />
      {organization.features.includes('ingest-through-trusted-relays-only') && (
        <FieldGroup title={t('Data Authenticity')}>
          <AutoSaveField
            name="ingestThroughTrustedRelaysOnly"
            schema={relaySchema}
            initialValue={organization.ingestThroughTrustedRelaysOnly === 'enabled'}
            confirm={value =>
              value
                ? t(
                    'Enabling this can lead to data being rejected for ALL projects, are you sure you want to continue?'
                  )
                : undefined
            }
            mutationOptions={{
              mutationFn: data =>
                fetchMutation<Organization>({
                  url: `/organizations/${organization.slug}/`,
                  method: 'PUT',
                  data: {
                    ingestThroughTrustedRelaysOnly: data.ingestThroughTrustedRelaysOnly
                      ? 'enabled'
                      : 'disabled',
                  },
                }),
              onSuccess: updatedOrg => {
                OrganizationStore.onUpdate(updatedOrg);
              },
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Ingest Through Trusted Relays Only')}
                hintText={t(
                  'Require events to be ingested only through trusted relays. Direct submissions from SDKs or other sources will be rejected unless signed by a registered relay.'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        </FieldGroup>
      )}
      <TextBlock>
        {tct(
          'Sentry Relay offers enterprise-grade data security by providing a standalone service that acts as a middle layer between your application and sentry.io. Go to [link:Relay Documentation] for setup and details.',
          {link: <ExternalLink href={RELAY_DOCS_LINK} />}
        )}
      </TextBlock>
      {relays.length === 0 ? (
        <EmptyState />
      ) : (
        <RelayUsageList
          orgSlug={organization.slug}
          disabled={disabled}
          relays={relays}
          api={api}
          onRelaysChange={setRelays}
        />
      )}
    </SentryDocumentTitle>
  );
}

function RelayUsageList({
  relays,
  orgSlug,
  disabled,
  api,
  onRelaysChange,
}: {
  api: ReturnType<typeof useApi>;
  disabled: boolean;
  onRelaysChange: (relays: Relay[]) => void;
  orgSlug: Organization['slug'];
  relays: Relay[];
}) {
  const {isPending, isError, refetch, data} = useApiQuery<RelayActivity[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/relay_usage/`, {
        path: {organizationIdOrSlug: orgSlug},
      }),
    ],
    {
      staleTime: 0,
      retry: false,
      enabled: relays.length > 0,
    }
  );

  const handleOpenEditDialog = useCallback(
    (publicKey: string) => {
      const editRelay = relays.find(relay => relay.publicKey === publicKey);

      if (!editRelay) {
        return;
      }

      openModal(modalProps => (
        <Edit
          {...modalProps}
          savedRelays={relays}
          api={api}
          orgSlug={orgSlug}
          relay={editRelay}
          onSubmitSuccess={response => {
            addSuccessMessage(t('Successfully updated Relay public key'));
            onRelaysChange(response.trustedRelays);
          }}
        />
      ));
    },
    [orgSlug, relays, api, onRelaysChange]
  );

  const handleDeleteRelay = useCallback(
    async (publicKey: string) => {
      const trustedRelays = relays
        .filter(relay => relay.publicKey !== publicKey)
        .map(relay => omit(relay, ['created', 'lastModified']));

      try {
        const response = await api.requestPromise(`/organizations/${orgSlug}/`, {
          method: 'PUT',
          data: {trustedRelays},
        });
        addSuccessMessage(t('Successfully deleted Relay public key'));
        onRelaysChange(response.trustedRelays);
      } catch {
        addErrorMessage(t('An unknown error occurred while deleting Relay public key'));
      }
    },
    [relays, api, orgSlug, onRelaysChange]
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <List
      relays={relays}
      relayActivities={data}
      disabled={disabled}
      onEdit={publicKey => () => handleOpenEditDialog(publicKey)}
      onRefresh={() => refetch()}
      onDelete={publicKey => () => handleDeleteRelay(publicKey)}
    />
  );
}
