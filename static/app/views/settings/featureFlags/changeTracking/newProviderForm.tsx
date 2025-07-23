import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {
  PROVIDER_TO_SETUP_WEBHOOK_URL,
  WebhookProviderEnum,
} from 'sentry/components/events/featureFlags/utils';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
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
import {
  makeFetchSecretQueryKey,
  type Secret,
} from 'sentry/views/settings/featureFlags/changeTracking';

type CreateSecretQueryVariables = {
  provider: string;
  secret: string;
};

type CreateSecretResponse = string;

export default function NewProviderForm({
  onCreatedSecret,
  onProviderChange,
  onSetProvider,
  canOverrideProvider,
  existingSecret,
}: {
  canOverrideProvider: boolean;
  onCreatedSecret: (secret: string) => void;
  onProviderChange: (provider: string) => void;
  onSetProvider: (provider: string) => void;
  existingSecret?: Secret;
}) {
  const initialData = {
    provider: '',
    secret: '',
  };
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedProvider, setSelectedProvider] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGoBack = useCallback(() => {
    navigate(
      normalizeUrl(`/settings/${organization.slug}/feature-flags/change-tracking/`)
    );
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
    onError: requestError => {
      const message =
        Array.isArray(requestError.responseJSON?.secret) &&
        requestError.responseJSON?.secret?.[0]
          ? requestError.responseJSON.secret[0]
          : t('Failed to add provider or secret.');
      handleXhrErrorResponse(message, requestError);
      addErrorMessage(message);
      setError(message);
    },
  });

  const canRead = hasEveryAccess(['org:read'], {organization});
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasAccess = canRead || canWrite || canAdmin;

  // if secret exists, updating; else adding
  const getButtonLabel = () => {
    if (existingSecret) {
      return t('Update Provider');
    }
    return t('Add Provider');
  };

  return (
    <Fragment>
      {error && (
        <Alert.Container>
          <Alert type="error" showIcon>
            {error}
          </Alert>
        </Alert.Container>
      )}

      <Form
        apiMethod="POST"
        initialData={initialData}
        apiEndpoint={`/organizations/${organization.slug}/flags/signing-secrets/`}
        onSubmit={({provider, secret}) => {
          setError(null);
          submitSecret({
            provider,
            secret,
          });
        }}
        onCancel={handleGoBack}
        submitLabel={getButtonLabel()}
        requireChanges
        submitDisabled={
          !hasAccess || isPending || !selectedProvider || !canOverrideProvider
        }
      >
        <SelectField
          required
          label={t('Provider')}
          onChange={value => {
            setSelectedProvider(value);
            onProviderChange(value);
          }}
          value={selectedProvider}
          placeholder={t('Select a provider')}
          name="provider"
          options={Object.values(WebhookProviderEnum).map(provider => ({
            value: provider,
            label: provider,
          }))}
          help={t(
            'If you have already linked this provider, pasting a new secret will override the existing secret.'
          )}
        />
        <StyledFieldGroup
          label={t('Webhook URL')}
          help={
            Object.keys(PROVIDER_TO_SETUP_WEBHOOK_URL).includes(selectedProvider)
              ? tct(
                  "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter this URL.",
                  {
                    link: (
                      <ExternalLink
                        href={
                          PROVIDER_TO_SETUP_WEBHOOK_URL[
                            selectedProvider as WebhookProviderEnum
                          ]
                        }
                      />
                    ),
                  }
                )
              : t(
                  "Create a webhook integration with your feature flag service. When you do so, you'll need to enter this URL."
                )
          }
          inline
          flexibleControlStateSize
        >
          <TextCopyInput
            aria-label={t('Webhook URL')}
            disabled={!selectedProvider.length}
          >
            {selectedProvider.length
              ? `https://sentry.io/api/0/organizations/${organization.slug}/flags/hooks/provider/${selectedProvider.toLowerCase()}/`
              : ''}
          </TextCopyInput>
        </StyledFieldGroup>
        <TextField
          name="secret"
          label={t('Secret')}
          maxLength={100}
          minLength={1}
          required
          help={t(
            'Paste the signing secret given by your provider when creating the webhook.'
          )}
        />
      </Form>
    </Fragment>
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  padding: ${space(2)};
`;
