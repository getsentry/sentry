import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextCopyInput from 'sentry/components/textCopyInput';
import apiApplication from 'sentry/data/forms/apiApplication';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {ApiApplication} from 'sentry/types/user';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  type ApiQueryKey,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const PAGE_TITLE = t('Application Details');

function getAppQueryKey(appId: string): ApiQueryKey {
  return [`/api-applications/${appId}/`];
}

interface RotateClientSecretResponse {
  clientSecret: string;
}

function ApiApplicationsDetails() {
  const api = useApi();
  const {appId} = useParams<{appId: string}>();
  const queryClient = useQueryClient();

  const urlPrefix = ConfigStore.get('urlPrefix');

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
              <Alert margin type="info" showIcon>
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

  return (
    <SentryDocumentTitle title={PAGE_TITLE}>
      <SettingsPageHeader title={PAGE_TITLE} />

      <Form
        apiMethod="PUT"
        apiEndpoint={`/api-applications/${appId}/`}
        saveOnBlur
        allowUndo
        initialData={app}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm forms={apiApplication} />

        <Panel>
          <PanelHeader>{t('Credentials')}</PanelHeader>

          <PanelBody>
            <FormField name="clientID" label="Client ID">
              {({value}: any) => (
                <TextCopyInput>
                  {getDynamicText({value, fixed: 'CI_CLIENT_ID'})}
                </TextCopyInput>
              )}
            </FormField>

            <FormField
              name="clientSecret"
              label={t('Client Secret')}
              help={t(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`)}
            >
              {({value}: any) =>
                value ? (
                  <TextCopyInput>
                    {getDynamicText({value, fixed: 'CI_CLIENT_SECRET'})}
                  </TextCopyInput>
                ) : (
                  <ClientSecret>
                    <HiddenSecret>{t('hidden')}</HiddenSecret>
                    <Confirm
                      onConfirm={rotateClientSecret}
                      message={t(
                        'Are you sure you want to rotate the client secret? The current one will not be usable anymore, and this cannot be undone.'
                      )}
                    >
                      <Button size="xs" priority="danger">
                        {t('Rotate client secret')}
                      </Button>
                    </Confirm>
                  </ClientSecret>
                )
              }
            </FormField>

            <FormField name="" label={t('Authorization URL')}>
              {() => <TextCopyInput>{`${urlPrefix}/oauth/authorize/`}</TextCopyInput>}
            </FormField>

            <FormField name="" label={t('Token URL')}>
              {() => <TextCopyInput>{`${urlPrefix}/oauth/token/`}</TextCopyInput>}
            </FormField>
          </PanelBody>
        </Panel>
      </Form>
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
