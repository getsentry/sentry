import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import trimEnd from 'lodash/trimEnd';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {
  AutoSaveForm,
  FieldGroup as FormFieldGroup,
  FormSearch,
} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Confirm} from 'sentry/components/confirm';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {ApiApplication} from 'sentry/types/user';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

const PAGE_TITLE = t('Application Details');

function getAppQueryKey(appId: string): ApiQueryKey {
  return [
    getApiUrl('/api-applications/$appId/', {
      path: {appId},
    }),
  ];
}

interface RotateClientSecretResponse {
  clientSecret: string;
}

const schema = z.object({
  name: z.string().min(1),
  homepageUrl: z.string(),
  privacyUrl: z.string(),
  termsUrl: z.string(),
  redirectUris: z.string(),
  allowedOrigins: z.string(),
});

function ApiApplicationsDetails() {
  const api = useApi();
  const {appId} = useParams<{appId: string}>();
  const queryClient = useQueryClient();

  const urlPrefix = ConfigStore.get('urlPrefix');
  const oauthBaseUrl = `${trimEnd(urlPrefix, '/')}/oauth`;

  const {
    data: app,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ApiApplication>(getAppQueryKey(appId), {
    staleTime: 0,
  });

  const {mutate: rotateClientSecret} = useMutation<RotateClientSecretResponse>({
    mutationFn: () => {
      return api.requestPromise(`/api-applications/${appId}/rotate-secret/`, {
        method: 'POST',
      });
    },
    onSuccess: data => {
      openModal(({Body, Header}) => (
        <Fragment>
          <Header>{t('Your new Client Secret')}</Header>
          <Body>
            <Alert.Container>
              <Alert variant="info">
                {t('This will be the only time your client secret is visible!')}
              </Alert>
            </Alert.Container>
            <TextCopyInput aria-label={t('new-client-secret')}>
              {data.clientSecret}
            </TextCopyInput>
          </Body>
        </Fragment>
      ));
    },
    onError: () => {
      addErrorMessage(t('Error rotating secret'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: getAppQueryKey(appId)});
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const apiApplicationEndpoint = `/api-applications/${appId}/`;

  const onSaveError = () => addErrorMessage(t('Unable to save change'));
  const onSaveSuccess = (updated: ApiApplication) => {
    setApiQueryData<ApiApplication>(queryClient, getAppQueryKey(appId), updated);
    addSuccessMessage(t('Changes applied.'));
  };

  const stringFieldMutationOptions = {
    mutationFn: (data: Partial<ApiApplication>) =>
      fetchMutation<ApiApplication>({url: apiApplicationEndpoint, method: 'PUT', data}),
    onSuccess: onSaveSuccess,
    onError: onSaveError,
  };

  return (
    <SentryDocumentTitle title={PAGE_TITLE}>
      <SettingsPageHeader
        title={PAGE_TITLE}
        subtitle={
          <Tag variant={app.isPublic ? 'info' : 'muted'}>
            {app.isPublic ? t('Public Client') : t('Confidential Client')}
          </Tag>
        }
      />

      {app.isPublic && (
        <Alert.Container>
          <Alert variant="info" showIcon>
            {t(
              'This is a public client, designed for CLIs, native apps, or SPAs. It uses PKCE, device authorization, and refresh token rotation for security instead of a client secret.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <FormSearch route="/settings/account/api/applications/:appId/">
        <FormFieldGroup title={t('Application Details')}>
          <AutoSaveForm
            name="name"
            schema={schema}
            initialValue={app.name}
            mutationOptions={stringFieldMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Name')}
                hintText={t('e.g. My Application')}
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="homepageUrl"
            schema={schema}
            initialValue={app.homepageUrl ?? ''}
            mutationOptions={stringFieldMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Homepage')}
                hintText={t("An optional link to your application's homepage")}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/"
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="privacyUrl"
            schema={schema}
            initialValue={app.privacyUrl ?? ''}
            mutationOptions={stringFieldMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Privacy Policy')}
                hintText={t('An optional link to your Privacy Policy')}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/privacy"
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="termsUrl"
            schema={schema}
            initialValue={app.termsUrl ?? ''}
            mutationOptions={stringFieldMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Terms of Service')}
                hintText={t('An optional link to your Terms of Service agreement')}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/terms"
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FormFieldGroup>

        <FormFieldGroup title={t('Security')}>
          <AutoSaveForm
            name="redirectUris"
            schema={schema}
            initialValue={convertMultilineFieldValue(app.redirectUris)}
            mutationOptions={{
              mutationFn: (data: {redirectUris: string}) =>
                fetchMutation<ApiApplication>({
                  url: apiApplicationEndpoint,
                  method: 'PUT',
                  data: {redirectUris: extractMultilineFields(data.redirectUris)},
                }),
              onSuccess: onSaveSuccess,
              onError: onSaveError,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Authorized Redirect URIs')}
                hintText={t('Separate multiple entries with a newline.')}
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/oauth/complete"
                  autosize
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="allowedOrigins"
            schema={schema}
            initialValue={convertMultilineFieldValue(app.allowedOrigins)}
            mutationOptions={{
              mutationFn: (data: {allowedOrigins: string}) =>
                fetchMutation<ApiApplication>({
                  url: apiApplicationEndpoint,
                  method: 'PUT',
                  data: {allowedOrigins: extractMultilineFields(data.allowedOrigins)},
                }),
              onSuccess: onSaveSuccess,
              onError: onSaveError,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Authorized JavaScript Origins')}
                hintText={t('Separate multiple entries with a newline.')}
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. example.com"
                  autosize
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FormFieldGroup>
      </FormSearch>

      <FormFieldGroup title={t('Credentials')}>
        <FieldGroup label={t('Client ID')} flexibleControlStateSize>
          <TextCopyInput>{app.clientID}</TextCopyInput>
        </FieldGroup>

        {!app.isPublic && (
          <FieldGroup
            label={t('Client Secret')}
            help={t(`Your secret is only available briefly after application creation. Make
                    sure to save this value!`)}
            flexibleControlStateSize
          >
            {app.clientSecret ? (
              <TextCopyInput>{app.clientSecret}</TextCopyInput>
            ) : (
              <ClientSecret>
                <HiddenSecret>{t('hidden')}</HiddenSecret>
                <Confirm
                  onConfirm={rotateClientSecret}
                  message={t(
                    'Are you sure you want to rotate the client secret? The current one will not be usable anymore, and this cannot be undone.'
                  )}
                >
                  <Button size="xs" variant="danger">
                    {t('Rotate client secret')}
                  </Button>
                </Confirm>
              </ClientSecret>
            )}
          </FieldGroup>
        )}

        <FieldGroup label={t('Authorization URL')} flexibleControlStateSize>
          <TextCopyInput>{`${oauthBaseUrl}/authorize/`}</TextCopyInput>
        </FieldGroup>

        <FieldGroup label={t('Token URL')} flexibleControlStateSize>
          <TextCopyInput>{`${oauthBaseUrl}/token/`}</TextCopyInput>
        </FieldGroup>

        {app.isPublic && (
          <Fragment>
            <FieldGroup label={t('Device Authorization URL')} flexibleControlStateSize>
              <TextCopyInput>{`${oauthBaseUrl}/device/code/`}</TextCopyInput>
            </FieldGroup>

            <FieldGroup label={t('Device Verification URL')} flexibleControlStateSize>
              <TextCopyInput>{`${oauthBaseUrl}/device/`}</TextCopyInput>
            </FieldGroup>
          </Fragment>
        )}
      </FormFieldGroup>
    </SentryDocumentTitle>
  );
}

const HiddenSecret = styled('span')`
  width: 100px;
  font-style: italic;
`;

const ClientSecret = styled('div')`
  display: flex;
  justify-content: right;
  align-items: center;
  margin-right: 0;
`;

export default ApiApplicationsDetails;
