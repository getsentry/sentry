import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchSecretQueryKey} from 'sentry/views/settings/featureFlags';

export type CreateSecretQueryVariables = {
  provider: string;
  secret: string;
};

export type CreateSecretResponse = string;

export default function NewProviderForm({
  onCreatedSecret,
}: {
  onCreatedSecret: (secret: string) => void;
}) {
  const initialData = {
    provider: '',
    secret: '',
  };
  const organization = useOrganization();

  const api = useApi();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(() => {
    browserHistory.push(normalizeUrl(`/settings/${organization.slug}/feature-flags/`));
  }, [organization.slug]);

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
            provider,
            secret,
          },
        }
      );
    },

    onSuccess: (_response, {secret}) => {
      addSuccessMessage(t('Added provider and secret.'));
      onCreatedSecret(secret);
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
    <Access access={['org:write']}>
      {({hasAccess}) => (
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
      )}
    </Access>
  );
}
