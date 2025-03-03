import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {ApiApplication} from 'sentry/types/user';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import Row from 'sentry/views/settings/account/apiApplications/row';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = RouteComponentProps;

function ApiApplications({router}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  const ENDPOINT = '/api-applications/';

  const {
    data: appList = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ApiApplication[]>([ENDPOINT], {
    staleTime: 0,
    enabled: !isDemoModeEnabled(),
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleCreateApplication = async () => {
    addLoadingMessage();

    try {
      const app = await api.requestPromise(ENDPOINT, {
        method: 'POST',
      });

      addSuccessMessage(t('Created a new API Application'));
      router.push(`${ROUTE_PREFIX}applications/${app.id}/`);
    } catch {
      addErrorMessage(t('Unable to remove application. Please try again.'));
    }
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
            icon={<IconAdd isCircled />}
          >
            {t('Create New Application')}
          </Button>
        }
      />

      <Panel>
        <PanelHeader>{t('Application Name')}</PanelHeader>

        <PanelBody>
          {!isEmpty ? (
            appList.map(app => (
              <Row key={app.id} app={app} onRemove={handleRemoveApplication} />
            ))
          ) : (
            <EmptyMessage>{t("You haven't created any applications yet.")}</EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

export default ApiApplications;
