import {RouteComponentProps} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ApiApplication} from 'sentry/types';
import AsyncView from 'sentry/views/asyncView';
import Row from 'sentry/views/settings/account/apiApplications/row';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = RouteComponentProps<{}, {}>;
type State = {
  appList: ApiApplication[];
} & AsyncView['state'];

class ApiApplications extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['appList', '/api-applications/']];
  }

  getTitle() {
    return t('API Applications');
  }

  handleCreateApplication = async () => {
    addLoadingMessage();

    try {
      const app = await this.api.requestPromise('/api-applications/', {
        method: 'POST',
      });

      addSuccessMessage(t('Created a new API Application'));
      this.props.router.push(`${ROUTE_PREFIX}applications/${app.id}/`);
    } catch {
      addErrorMessage(t('Unable to remove application. Please try again.'));
    }
  };

  handleRemoveApplication = (app: ApiApplication) => {
    this.setState({
      appList: this.state.appList.filter(a => a.id !== app.id),
    });
  };

  renderBody() {
    const isEmpty = this.state.appList.length === 0;

    return (
      <div>
        <SettingsPageHeader
          title="API Applications"
          action={
            <Button
              priority="primary"
              size="sm"
              onClick={this.handleCreateApplication}
              icon={<IconAdd size="xs" isCircled />}
            >
              {t('Create New Application')}
            </Button>
          }
        />

        <Panel>
          <PanelHeader>{t('Application Name')}</PanelHeader>

          <PanelBody>
            {!isEmpty ? (
              this.state.appList.map(app => (
                <Row
                  api={this.api}
                  key={app.id}
                  app={app}
                  onRemove={this.handleRemoveApplication}
                />
              ))
            ) : (
              <EmptyMessage>
                {t("You haven't created any applications yet.")}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ApiApplications;
