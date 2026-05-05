import {useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ApiApplication} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {Row} from 'sentry/views/settings/account/apiApplications/row';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

const ROUTE_PREFIX = '/settings/account/api/';

export default function ApiApplications() {
  const api = useApi();
  const hasPageFrame = useHasPageFrameFeature();
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

  const action = (
    <Button
      variant="primary"
      size="sm"
      onClick={handleCreateApplication}
      icon={<IconAdd />}
      aria-label={t('Create New Application')}
    >
      {t('Create New Application')}
    </Button>
  );

  return (
    <SentryDocumentTitle title={t('API Applications')}>
      <SettingsPageHeader
        title="API Applications"
        action={hasPageFrame ? undefined : action}
      />

      {hasPageFrame && (
        <Flex justify="end" marginBottom="xl">
          {action}
        </Flex>
      )}

      <ApplicationsTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Application Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="age">
            {t('Age')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="actions" />
        </SimpleTable.Header>

        {isEmpty ? (
          <SimpleTable.Empty data-test-id="empty-message">
            {t("You haven't created any applications yet.")}
          </SimpleTable.Empty>
        ) : (
          appList.map(app => (
            <Row key={app.id} app={app} onRemove={handleRemoveApplication} />
          ))
        )}
      </ApplicationsTable>
    </SentryDocumentTitle>
  );
}

const ApplicationsTable = styled(SimpleTable)`
  grid-template-columns: minmax(220px, 1fr) minmax(100px, 160px) max-content;

  [data-column-name='actions'] {
    padding-left: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr) max-content;

    [data-column-name='age'] {
      display: none;
    }
  }
`;

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
        <Grid flow="column" align="center" gap="sm">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button variant="primary" type="submit">
            {t('Create Application')}
          </Button>
        </Grid>
      </Footer>
    </form>
  );
}
