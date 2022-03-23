import {RouteComponentProps} from 'react-router';

import {removeSentryApp} from 'sentry/actionCreators/sentryApps';
import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization, SentryApp} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow';

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
            size="xsmall"
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
            size="xsmall"
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
        <SettingsPageHeader
          title={t('Developer Settings')}
          body={t(
            `Create integrations that interact with Sentry using the REST API and webhooks.`
          )}
          action={
            <Button
              size="small"
              external
              href="https://docs.sentry.io/product/integrations/integration-platform/"
            >
              {t('View Docs')}
            </Button>
          }
        />
        <Alert type="info">
          {tct(
            'Integrations can now detect when a comment on an issue is added or changes.  [link:Learn more].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/#comments" />
              ),
            }
          )}
        </Alert>
        {this.renderExernalIntegrations()}
        {this.renderInternalIntegrations()}
      </div>
    );
  }
}

export default withOrganization(OrganizationDeveloperSettings);
