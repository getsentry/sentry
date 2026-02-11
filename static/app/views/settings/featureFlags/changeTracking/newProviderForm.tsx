import {useCallback} from 'react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
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

interface Props {
  canSaveSecret: boolean;
  onCreatedSecret: (secret: string) => void;
  selectedProvider: string;
  setError: (error: string | null) => void;
  setSelectedProvider: (provider: string) => void;
  existingSecret?: Secret;
}

export default function NewProviderForm({
  onCreatedSecret,
  setSelectedProvider,
  selectedProvider,
  setError: setError,
  canSaveSecret,
  existingSecret,
}: Props) {
  const initialData = {
    provider: '',
    secret: '',
  };
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
      setSelectedProvider(provider);
      queryClient.invalidateQueries({
        queryKey: makeFetchSecretQueryKey({orgSlug: organization.slug}),
      });
    },
    onError: error => {
      clearIndicators();
      const responseJSON = error.responseJSON;

      const hasFieldSpecificErrors = responseJSON?.secret || responseJSON?.provider;

      if (!hasFieldSpecificErrors) {
        // Only show banner if there are no field-specific errors
        const message =
          typeof responseJSON === 'string'
            ? responseJSON
            : t('Failed to add provider or secret.');
        handleXhrErrorResponse(message, error);
        setError(message);
      }
    },
  });

  return (
    <Form
      initialData={initialData}
      onSubmit={(data, onFormSubmitSuccess, onFormSubmitError) => {
        submitSecret(
          {
            provider: data.provider,
            secret: data.secret,
          },
          {
            onSuccess: () => {
              onFormSubmitSuccess({});
            },
            onError: error => {
              // Only call onSubmitError for field-specific errors
              // General errors are already handled in the mutation's onError
              if (error.responseJSON?.secret || error.responseJSON?.provider) {
                onFormSubmitError(error);
              }
            },
          }
        );
      }}
      onCancel={handleGoBack}
      submitLabel={existingSecret ? t('Update Provider') : t('Add Provider')}
      requireChanges
      submitDisabled={!selectedProvider || !canSaveSecret || isPending}
    >
      <SelectField
        required
        label={t('Provider')}
        onChange={value => {
          setSelectedProvider(value);
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
        <TextCopyInput aria-label={t('Webhook URL')} disabled={!selectedProvider.length}>
          {selectedProvider.length
            ? `${window.location.origin}/api/0/organizations/${organization.slug}/flags/hooks/provider/${selectedProvider.toLowerCase()}/`
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
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  padding: ${space(2)};
`;
