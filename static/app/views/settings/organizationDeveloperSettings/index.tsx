import {RouteComponentProps} from 'react-router';

import {removeSentryApp} from 'app/actionCreators/sentryApps';
import Access from 'app/components/acl/access';
import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {Organization, SentryApp} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';

type Props = Omit<AsyncView['props'], 'params'> & {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncView['state'] & {
  applications: SentryApp[];
};

class OrganizationDeveloperSettings extends AsyncView<Props, State> {
  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Developer Settings'), orgId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;

    return [['applications', `/organizations/${orgId}/sentry-apps/`]];
  }

  removeApp = (app: SentryApp) => {
    const apps = this.state.applications.filter(a => a.slug !== app.slug);
    removeSentryApp(this.api, app).then(
      () => {
        this.setState({applications: apps});
      },
      () => {}
    );
  };

  renderApplicationRow = (app: SentryApp) => {
    const {organization} = this.props;
    return (
      <SentryApplicationRow
        key={app.uuid}
        app={app}
        organization={organization}
        onRemoveApp={this.removeApp}
      />
    );
  };

  renderInternalIntegrations() {
    const {orgId} = this.props.params;
    const {organization} = this.props;
    const integrations = this.state.applications.filter(
      (app: SentryApp) => app.status === 'internal'
    );
    const isEmpty = integrations.length === 0;

    const permissionTooltipText = t(
      'Manager or Owner permissions required to add an internal integration.'
    );

    const action = (
      <Access organization={organization} access={['org:write']}>
        {({hasAccess}) => (
          <Button
            priority="primary"
            disabled={!hasAccess}
            title={!hasAccess ? permissionTooltipText : undefined}
            size="small"
            to={`/settings/${orgId}/developer-settings/new-internal/`}
            icon={<IconAdd size="xs" isCircled />}
          >
            {t('New Internal Integration')}
          </Button>
        )}
      </Access>
    );

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Internal Integrations')}
          {action}
        </PanelHeader>
        <PanelBody>
          {!isEmpty ? (
            integrations.map(this.renderApplicationRow)
          ) : (
            <EmptyMessage>
              {t('No internal integrations have been created yet.')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }

  renderExernalIntegrations() {
    const {orgId} = this.props.params;
    const {organization} = this.props;
    const integrations = this.state.applications.filter(app => app.status !== 'internal');
    const isEmpty = integrations.length === 0;

    const permissionTooltipText = t(
      'Manager or Owner permissions required to add a public integration.'
    );

    const action = (
      <Access organization={organization} access={['org:write']}>
        {({hasAccess}) => (
          <Button
            priority="primary"
            disabled={!hasAccess}
            title={!hasAccess ? permissionTooltipText : undefined}
            size="small"
            to={`/settings/${orgId}/developer-settings/new-public/`}
            icon={<IconAdd size="xs" isCircled />}
          >
            {t('New Public Integration')}
          </Button>
        )}
      </Access>
    );

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Public Integrations')}
          {action}
        </PanelHeader>
        <PanelBody>
          {!isEmpty ? (
            integrations.map(this.renderApplicationRow)
          ) : (
            <EmptyMessage>
              {t('No public integrations have been created yet.')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Developer Settings')} />
        <AlertLink href="https://docs.sentry.io/product/integrations/integration-platform/">
          {t(
            'Have questions about the Integration Platform? Learn more about it in our docs.'
          )}
        </AlertLink>
        {this.renderExernalIntegrations()}
        {this.renderInternalIntegrations()}
      </div>
    );
  }
}

export default withOrganization(OrganizationDeveloperSettings);
