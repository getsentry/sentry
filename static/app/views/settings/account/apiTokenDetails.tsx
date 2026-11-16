import {useCallback} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {toast} from '@sentry/scraps/toast';

import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens/tokenUtils';

import {apiTokensOptions} from './apiTokensOptions';

const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';

type FetchApiTokenParameters = {
  tokenId: string;
};
type FetchApiTokenResponse = InternalAppApiToken;

const tokenOptions = ({tokenId}: FetchApiTokenParameters) =>
  apiOptions.as<FetchApiTokenResponse>()('/api-tokens/$tokenId/', {
    path: {tokenId},
    staleTime: Infinity,
  });

const schema = z.object({
  name: z.string(),
});

function ApiTokenDetailsForm({token}: {token: InternalAppApiToken}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(normalizeUrl(API_INDEX_ROUTE)),
    [navigate]
  );

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation({
        url: getApiUrl('/api-tokens/$tokenId/', {path: {tokenId: token.id}}),
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, {name}) => {
      toast.success(t('Updated user auth token.'));

      // Update get by id query
      queryClient.setQueryData(tokenOptions({tokenId: token.id}).queryKey, response =>
        response?.json ? {...response, json: {...response.json, name}} : response
      );

      // Update get list query
      if (queryClient.getQueryData(apiTokensOptions.queryKey)?.json) {
        queryClient.setQueryData(apiTokensOptions.queryKey, response =>
          response && Array.isArray(response.json)
            ? {
                ...response,
                json: response.json.map(oldToken =>
                  oldToken.id === token.id ? {...oldToken, name} : oldToken
                ),
              }
            : response
        );
      }

      handleGoBack();
    },
    onError: (error: RequestError) => {
      const message = t('Failed to update the user auth token.');
      handleXhrErrorResponse(message, error);
      toast.error(message);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: token.name},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      toast.loading(t('Saving changes...'));
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title={t('Personal Token Details')}>
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('A name to help you identify this token.')}
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>

        <FieldGroup
          label={t('Token')}
          help={t('You can only view the token once after creation.')}
        >
          <div>{tokenPreview(token.tokenLastCharacters || '****')}</div>
        </FieldGroup>

        <FieldGroup
          label={t('Scopes')}
          help={t('You cannot change the scopes of an existing token.')}
        >
          <div>{token.scopes.toSorted().join(', ')}</div>
        </FieldGroup>
      </form.FieldGroup>

      <Flex justify="end" gap="md" padding="md">
        <Button onClick={handleGoBack}>{t('Cancel')}</Button>
        <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

function ApiTokenDetails() {
  const {tokenId} = useParams<{tokenId: string}>();

  const {
    isPending,
    isError,
    data: token,
    refetch: refetchToken,
  } = useQuery(tokenOptions({tokenId}));

  return (
    <div>
      <SentryDocumentTitle title={t('Edit Personal Token')} />
      <SettingsPageHeader title={t('Edit Personal Token')} />

      <TextBlock>
        {t(
          "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
        )}
      </TextBlock>
      <TextBlock>
        {tct(
          'For more information on how to use the web API, see our [link:documentation].',
          {
            link: <ExternalLink href="https://docs.sentry.io/api/" />,
          }
        )}
      </TextBlock>

      {isError && (
        <LoadingError
          message={t('Failed to load personal token.')}
          onRetry={refetchToken}
        />
      )}

      {isPending && <LoadingIndicator />}

      {!isPending && !isError && token && <ApiTokenDetailsForm token={token} />}
    </div>
  );
}

export default ApiTokenDetails;
