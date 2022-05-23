import React, {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {openCreateNewIntegrationModal} from 'sentry/actionCreators/modal';
import {removeSentryApp} from 'sentry/actionCreators/sentryApps';
import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import NavTabs from 'sentry/components/navTabs';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SentryApp} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow';

type Props = Omit<AsyncView['props'], 'params'> & {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type Tab = 'public' | 'internal';
type State = AsyncView['state'] & {
  applications: SentryApp[];
  tab: Tab;
};

class OrganizationDeveloperSettings extends AsyncView<Props, State> {
  getDefaultState(): State {
    const {location} = this.props;
    const value =
      (['public', 'internal'] as const).find(tab => tab === location?.query?.type) ||
      'internal';

    return {
      ...super.getDefaultState(),
      applications: [],
      tab: value,
    };
  }

  get tab() {
    return this.state.tab;
  }

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

  onTabChange = (value: Tab) => {
    this.setState({tab: value});
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
    const integrations = this.state.applications.filter(
      (app: SentryApp) => app.status === 'internal'
    );
    const isEmpty = integrations.length === 0;

    return (
      <Panel>
        <PanelHeader>{t('Internal Integrations')}</PanelHeader>
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

  renderPublicIntegrations() {
    const integrations = this.state.applications.filter(app => app.status !== 'internal');
    const isEmpty = integrations.length === 0;

    return (
      <Panel>
        <PanelHeader>{t('Public Integrations')}</PanelHeader>
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

  renderTabContent(tab: Tab) {
    switch (tab) {
      case 'internal':
        return this.renderInternalIntegrations();
      case 'public':
      default:
        return this.renderPublicIntegrations();
    }
  }
  renderBody() {
    const {organization} = this.props;

    const permissionTooltipText = t(
      'Manager or Owner permissions are required to create a new integration'
    );

    const tabs = [
      ['internal', t('Internal Integration')],
      ['public', t('Public Integration')],
    ] as [id: Tab, label: string][];

    const action = (
      <Access organization={organization} access={['org:write']}>
        {({hasAccess}) => (
          <Button
            priority="primary"
            disabled={!hasAccess}
            title={!hasAccess ? permissionTooltipText : undefined}
            size="small"
            onClick={() =>
              openCreateNewIntegrationModal({
                orgSlug: organization.slug,
              })
            }
          >
            {t('Create New Integration')}
          </Button>
        )}
      </Access>
    );

    return (
      <div>
        <SettingsPageHeader
          title={t('Developer Settings')}
          body={
            <React.Fragment>
              {t(
                'Create integrations that interact with Sentry using the REST API and webhooks. '
              )}
              {tct(
                'Looking for code snippets? Check out the [link: quick start] for Python and TypeScript examples.',
                {
                  link: (
                    <ExternalLink
                      href="https://docs.sentry.io/product/integrations/integration-platform/#quick-start"
                      onClick={() => {
                        trackAdvancedAnalyticsEvent('ecosystem.quick_start_clicked', {
                          organization,
                          view: 'developer_settings',
                        });
                      }}
                    />
                  ),
                }
              )}
            </React.Fragment>
          }
          action={
            <Fragment>
              <Button
                size="small"
                external
                href="https://docs.sentry.io/product/integrations/integration-platform/"
                style={{marginRight: space(1)}}
              >
                {t('View Docs')}
              </Button>
              <Button
                size="small"
                external
                href="https://github.com/getsentry/integration-platform-example/"
                style={{marginRight: space(1)}}
                onClick={() => {
                  trackAdvancedAnalyticsEvent('ecosystem.example_source_code_clicked', {
                    organization,
                    view: 'developer_settings',
                  });
                }}
              >
                {t('View Example')}
              </Button>
              {action}
            </Fragment>
          }
        />
        <Alert type="info">
          {tct(
            'Integrations can now detect when a comment on an issue is added or changes.  [link:Learn more].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/comments" />
              ),
            }
          )}
        </Alert>

        <NavTabs underlined>
          {tabs.map(([type, label]) => (
            <li
              key={type}
              className={this.tab === type ? 'active' : ''}
              onClick={() => this.onTabChange(type)}
            >
              <a>{label}</a>
            </li>
          ))}
        </NavTabs>
        {this.renderTabContent(this.tab)}
      </div>
    );
  }
}

export default withOrganization(OrganizationDeveloperSettings);
