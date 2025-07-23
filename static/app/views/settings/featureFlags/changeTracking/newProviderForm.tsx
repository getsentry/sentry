import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
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
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  makeFetchSecretQueryKey,
  type Secret,
} from 'sentry/views/settings/featureFlags/changeTracking';

export default function NewProviderForm({
  onCreatedSecret,
  onProviderChange,
  onSetProvider,
  onError,
  canOverrideProvider,
  existingSecret,
}: {
  canOverrideProvider: boolean;
  onCreatedSecret: (secret: string) => void;
  onError: (error: string | null) => void;
  onProviderChange: (provider: string) => void;
  onSetProvider: (provider: string) => void;
  existingSecret?: Secret;
}) {
  const initialData = {
    provider: '',
    secret: '',
  };
  const organization = useOrganization();
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState('');

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/flags/signing-secrets/`,
        {
          method: 'POST',
          data: {
            provider: data.provider?.toLowerCase(),
            secret: data.secret,
          },
        }
      );
    },
    onMutate: () => {
      addLoadingMessage();
    },
    onSuccess: (_response, data) => {
      clearIndicators();
      addSuccessMessage(t('Added provider and secret.'));
      onCreatedSecret(data.secret);
      onSetProvider(data.provider);
      queryClient.invalidateQueries({
        queryKey: makeFetchSecretQueryKey({orgSlug: organization.slug}),
      });
    },
    onError: (error: any, _data) => {
      clearIndicators();
      const responseJSON = error.responseJSON;

      // Check if there are field-specific errors for 'secret' or 'provider'
      const hasFieldSpecificErrors =
        (responseJSON?.secret &&
          Array.isArray(responseJSON.secret) &&
          responseJSON.secret.length > 0) ||
        (responseJSON?.provider &&
          Array.isArray(responseJSON.provider) &&
          responseJSON.provider.length > 0);

      if (!hasFieldSpecificErrors) {
        // General error - pass to parent component
        const message =
          responseJSON?.detail ||
          responseJSON?.non_field_errors?.[0] ||
          responseJSON?.nonFieldErrors?.[0] ||
          t('Failed to add provider or secret.');
        onError(message);
      }
      // For field-specific errors, we re-throw the error so the Form component can handle them
      throw error;
    },
  });

  // if secret exists, updating; else adding
  const getButtonLabel = () => {
    if (existingSecret) {
      return t('Update Provider');
    }
    return t('Add Provider');
  };

  const handleGoBack = useCallback(() => {
    navigate(
      normalizeUrl(`/settings/${organization.slug}/feature-flags/change-tracking/`)
    );
  }, [organization.slug, navigate]);

  const canRead = hasEveryAccess(['org:read'], {organization});
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasAccess = canRead || canWrite || canAdmin;

  return (
    <Form
      initialData={initialData}
      onSubmit={(data, onSubmitSuccess, onSubmitError) => {
        mutation.mutate(data, {
          onSuccess: onSubmitSuccess,
          onError: onSubmitError,
        });
      }}
      onCancel={handleGoBack}
      submitLabel={getButtonLabel()}
      requireChanges
      submitDisabled={!hasAccess || !selectedProvider || !canOverrideProvider}
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
        <TextCopyInput aria-label={t('Webhook URL')} disabled={!selectedProvider.length}>
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
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  padding: ${space(2)};
`;
