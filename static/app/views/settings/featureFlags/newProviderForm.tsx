import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {PROVIDER_OPTION_TO_URLS} from 'sentry/components/events/featureFlags/utils';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchSecretQueryKey} from 'sentry/views/settings/featureFlags';

export type CreateSecretQueryVariables = {
  provider: string;
  secret: string;
};

export type CreateSecretResponse = string;

export default function NewProviderForm({
  onCreatedSecret,
  onSetProvider,
}: {
  onCreatedSecret: (secret: string) => void;
  onSetProvider: (provider: string) => void;
}) {
  const initialData = {
    provider: '',
    secret: '',
  };
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedProvider, setSelectedProvider] = useState('<provider_name>');

  const handleGoBack = useCallback(() => {
    navigate(normalizeUrl(`/settings/${organization.slug}/feature-flags/`));
  }, [organization.slug, navigate]);

  const {mutate: submitSecret, isPending} = useMutation<
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
            provider: provider.toLowerCase(),
            secret,
          },
        }
      );
    },

    onSuccess: (_response, {secret, provider}) => {
      addSuccessMessage(t('Added provider and secret.'));
      onCreatedSecret(secret);
      onSetProvider(provider);
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

  const canRead = hasEveryAccess(['org:read'], {organization});
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasAccess = canRead || canWrite || canAdmin;

  return (
    <Form
      apiMethod="POST"
      initialData={initialData}
      apiEndpoint={`/organizations/${organization.slug}/flags/signing-secret/`}
      onSubmit={({provider, secret}) => {
        submitSecret({
          provider,
          secret,
        });
      }}
      onCancel={handleGoBack}
      submitLabel={t('Add Provider')}
      requireChanges
      submitDisabled={!hasAccess || isPending}
    >
      <SelectField
        required
        label={t('Provider')}
        onChange={setSelectedProvider}
        value={selectedProvider}
        placeholder={t('Select a provider')}
        name="provider"
        options={[
          {value: 'LaunchDarkly', label: 'LaunchDarkly'},
          {value: 'Generic', label: 'Generic'},
          {value: 'Unleash', label: 'Unleash'},
        ]}
        help={t(
          'If you have already linked this provider, pasting a new secret will override the existing secret.'
        )}
      />
      <StyledFieldGroup
        label={t('Webhook URL')}
        help={tct(
          "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter this URL.",
          {
            link: <ExternalLink href={PROVIDER_OPTION_TO_URLS[selectedProvider]} />,
          }
        )}
        inline
        flexibleControlStateSize
      >
        <TextCopyInput
          aria-label={t('Webhook URL')}
        >{`https://sentry.io/api/0/organizations/${organization.slug}/flags/hooks/provider/${selectedProvider.toLowerCase()}/`}</TextCopyInput>
      </StyledFieldGroup>
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

const StyledFieldGroup = styled(FieldGroup)`
  padding: ${space(2)};
`;
