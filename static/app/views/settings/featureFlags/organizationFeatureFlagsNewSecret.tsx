import {useCallback, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {makeFetchSecretQueryKey} from 'sentry/views/settings/featureFlags';
import NewSecretHandler from 'sentry/views/settings/featureFlags/newSecretHandler';

type CreateSecretQueryVariables = {
  provider: string;
  secret: string;
};

type CreateSecretResponse = string;

function NewProviderForm({
  organization,
  onCreatedSecret,
}: {
  onCreatedSecret: (secret: string) => void;
  organization: Organization;
}) {
  const initialData = {
    provider: '',
    secret: '',
  };

  const api = useApi();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(() => {
    browserHistory.push(normalizeUrl(`/settings/${organization.slug}/feature-flags/`));
  }, [organization.slug]);

  const {mutate: submitSecret} = useMutation<
    CreateSecretResponse,
    RequestError,
    CreateSecretQueryVariables
  >({
    mutationFn: ({provider, secret}) => {
      addLoadingMessage();
      return api.requestPromise(
        `/organizations/${organization.slug}/flags/signing-secrets/`,
        {
          method: 'POST',
          data: {
            provider,
            secret,
          },
        }
      );
    },

    onSuccess: () => {
      addSuccessMessage(t('Added provider and secret.'));
      queryClient.invalidateQueries({
        queryKey: makeFetchSecretQueryKey({orgSlug: organization.slug}),
      });
    },
    onError: error => {
      const message = t('Failed to add provider or secret.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  return (
    <Form
      apiMethod="POST"
      initialData={initialData}
      apiEndpoint={`/organizations/${organization.slug}/flags/signing-secret`}
      onSubmit={({provider, secret}) =>
        submitSecret({
          provider,
          secret,
        })
      }
      onSubmitSuccess={({secret}) => {
        onCreatedSecret(secret);
      }}
      onCancel={handleGoBack}
      submitLabel={t('Add Provider')}
      requireChanges
    >
      <SelectField
        required
        label={t('Provider')}
        name="provider"
        options={[{value: 'launchdarkly', label: 'LaunchDarkly'}]}
        placeholder={t('Select one')}
        help={t(
          'If you have already linked this provider, pasting a new secret will override the existing secret.'
        )}
      />
      <TextField
        name="secret"
        label={t('Secret')}
        maxLength={32}
        minLength={32}
        required
        help={t(
          'Paste the signing secret given by your provider when creating the webhook.'
        )}
      />
    </Form>
  );
}

export function OrganizationFeatureFlagsNewSecet({
  organization,
}: {
  organization: Organization;
}) {
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const handleGoBack = useCallback(() => {
    browserHistory.push(normalizeUrl(`/settings/${organization.slug}/feature-flags/`));
  }, [organization.slug]);

  return (
    <div>
      <SentryDocumentTitle title={t('Add New Provider')} />
      <SettingsPageHeader title={t('Add New Provider')} />

      <TextBlock>
        {t(
          'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. This page lists the webhooks you have set up with external providers. Note that each provider can only have one associated signing secret.'
        )}
      </TextBlock>
      <TextBlock>
        {tct(
          'Learn more about how to interact with feature flag insights within the Sentry UI by reading the [link:documentation].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#feature-flags" />
            ),
          }
        )}
      </TextBlock>

      <Panel>
        <PanelHeader>{t('Add New Provider')}</PanelHeader>

        <PanelBody>
          {newSecret ? (
            <NewSecretHandler handleGoBack={handleGoBack} secret={newSecret} />
          ) : (
            <NewProviderForm
              organization={organization}
              onCreatedSecret={(secret: string) => setNewSecret(secret)}
            />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationFeatureFlagsNewSecet);
