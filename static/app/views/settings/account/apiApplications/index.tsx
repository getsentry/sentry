import {useState} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import EmptyMessage from 'sentry/components/emptyMessage';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ApiApplication} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import Row from 'sentry/views/settings/account/apiApplications/row';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ROUTE_PREFIX = '/settings/account/api/';

export default function ApiApplications() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const ENDPOINT = getApiUrl('/api-applications/');

  const {
    data: appList = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ApiApplication[]>([ENDPOINT], {
    staleTime: 0,
    enabled: !isDemoModeActive(),
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const createApplication = async (isPublic: boolean) => {
    addLoadingMessage();

    try {
      const app = await api.requestPromise(ENDPOINT, {
        method: 'POST',
        data: {isPublic},
      });

      addSuccessMessage(t('Created a new API Application'));
      navigate(`${ROUTE_PREFIX}applications/${app.id}/`);
    } catch {
      addErrorMessage(t('Unable to create application. Please try again.'));
    }
  };

  const handleCreateApplication = () => {
    openModal(({Body, Header, Footer, closeModal}) => (
      <CreateApplicationModal
        Body={Body}
        Header={Header}
        Footer={Footer}
        closeModal={closeModal}
        onSubmit={(isPublic: boolean) => {
          closeModal();
          createApplication(isPublic);
        }}
      />
    ));
  };

  const handleRemoveApplication = (app: ApiApplication) => {
    setApiQueryData<any>(queryClient, [ENDPOINT], (oldAppList: any) =>
      oldAppList.filter((a: any) => a.id !== app.id)
    );
  };

  const isEmpty = appList.length === 0;

  return (
    <SentryDocumentTitle title={t('API Applications')}>
      <SettingsPageHeader
        title="API Applications"
        action={
          <Button
            priority="primary"
            size="sm"
            onClick={handleCreateApplication}
            icon={<IconAdd />}
            aria-label={t('Create New Application')}
          >
            {t('Create New Application')}
          </Button>
        }
      />

      <Panel>
        <PanelHeader>{t('Application Name')}</PanelHeader>

        <PanelBody>
          {isEmpty ? (
            <EmptyMessage>{t("You haven't created any applications yet.")}</EmptyMessage>
          ) : (
            appList.map(app => (
              <Row key={app.id} app={app} onRemove={handleRemoveApplication} />
            ))
          )}
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

interface CreateApplicationModalProps {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  closeModal: ModalRenderProps['closeModal'];
  onSubmit: (isPublic: boolean) => void;
}

function CreateApplicationModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSubmit,
}: CreateApplicationModalProps) {
  const [clientType, setClientType] = useState<'confidential' | 'public'>('confidential');

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit(clientType === 'public');
      }}
    >
      <Header closeButton>
        <h4>{t('Create New Application')}</h4>
      </Header>
      <Body>
        <p>
          {t(
            'Choose the type of OAuth application based on how it will authenticate with Sentry.'
          )}
        </p>
        <RadioGroup
          label={t('Client Type')}
          value={clientType}
          onChange={value => setClientType(value)}
          choices={[
            [
              'confidential',
              t('Confidential'),
              t(
                'For server-side applications that can securely store a client secret. Uses client credentials for authentication.'
              ),
            ],
            [
              'public',
              t('Public'),
              t(
                'For CLIs, native apps, or SPAs that cannot securely store secrets. Uses PKCE, device authorization, and refresh token rotation for security.'
              ),
            ],
          ]}
        />
      </Body>
      <Footer>
        <ButtonBar gap="sm">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" type="submit">
            {t('Create Application')}
          </Button>
        </ButtonBar>
      </Footer>
    </form>
  );
}
