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
        <div>
          {tct(
            "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter a URL, which you can find below.",
            {link: <ExternalLink href={PROVIDER_OPTION_TO_URLS["launchdarkly"]} />}
          )}
        </div>
        <InputTitle>{t('Webhook URL')}</InputTitle>
        <TextCopyInput
          style={{padding: '20px'}}
          aria-label={t('Webhook URL')}
          size="sm"
        >
          {`https://sentry.io/api/0/organizations/${organization.slug}/flags/hooks/provider/launchdarkly/`}
        </TextCopyInput>
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
            selected="launchdarkly"
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
