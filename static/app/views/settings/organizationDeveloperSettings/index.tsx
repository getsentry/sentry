import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {removeSentryApp} from 'sentry/actionCreators/sentryApps';
import {removeSentryFunction} from 'sentry/actionCreators/sentryFunctions';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import NavTabs from 'sentry/components/navTabs';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, SentryApp, SentryFunction} from 'sentry/types';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import CreateIntegrationButton from 'sentry/views/settings/organizationIntegrations/createIntegrationButton';
import ExampleIntegrationButton from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

import SentryFunctionRow from './sentryFunctionRow';

type Props = Omit<DeprecatedAsyncView['props'], 'params'> & {
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type Tab = 'public' | 'internal' | 'sentryfx';
type State = DeprecatedAsyncView['state'] & {
  applications: SentryApp[];
  tab: Tab;
};

class OrganizationDeveloperSettings extends DeprecatedAsyncView<Props, State> {
  analyticsView = 'developer_settings' as const;

  getDefaultState(): State {
    const {location} = this.props;
    const value =
      (['public', 'internal', 'sentryfx'] as const).find(
        tab => tab === location?.query?.type
      ) || 'internal';

    return {
      ...super.getDefaultState(),
      applications: [],
      sentryFunctions: [],
      tab: value,
    };
  }

  get tab() {
    return this.state.tab;
  }

  getTitle() {
    const {organization} = this.props;
    return routeTitleGen(t('Custom Integrations'), organization.slug, false);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    const returnValue: [string, string, any?, any?][] = [
      ['applications', `/organizations/${organization.slug}/sentry-apps/`],
    ];
    if (organization.features.includes('sentry-functions')) {
      returnValue.push([
        'sentryFunctions',
        `/organizations/${organization.slug}/functions/`,
      ]);
    }
    return returnValue;
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

  removeFunction = (organization: Organization, sentryFunction: SentryFunction) => {
    const functionsToKeep = this.state.sentryFunctions?.filter(
      fn => fn.name !== sentryFunction.name
    );
    if (!functionsToKeep) {
      return;
    }
    removeSentryFunction(this.api, organization, sentryFunction).then(
      isSuccess => {
        if (isSuccess) {
          this.setState({sentryFunctions: functionsToKeep});
        }
      },
      () => {}
    );
  };

  onTabChange = (value: Tab) => {
    this.setState({tab: value});
  };

  renderSentryFunction = (sentryFunction: SentryFunction) => {
    const {organization} = this.props;
    return (
      <SentryFunctionRow
        key={organization.slug + sentryFunction.name}
        organization={organization}
        sentryFunction={sentryFunction}
        onRemoveFunction={this.removeFunction}
      />
    );
  };

  renderSentryFunctions() {
    const {sentryFunctions} = this.state;

    return (
      <Panel>
        <PanelHeader>{t('Sentry Functions')}</PanelHeader>
        <PanelBody>
          {sentryFunctions?.length ? (
            sentryFunctions.map(this.renderSentryFunction)
          ) : (
            <EmptyMessage>{t('No Sentry Functions have been created yet.')}</EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }

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
      case 'sentryfx':
        return this.renderSentryFunctions();
      case 'internal':
        return this.renderInternalIntegrations();
      case 'public':
      default:
        return this.renderPublicIntegrations();
    }
  }
  renderBody() {
    const {organization} = this.props;
    const tabs: [id: Tab, label: string][] = [
      ['internal', t('Internal Integration')],
      ['public', t('Public Integration')],
    ];

    if (organization.features.includes('sentry-functions')) {
      tabs.push(['sentryfx', t('Sentry Function')]);
    }

    return (
      <div>
        <SettingsPageHeader
          title={t('Custom Integrations')}
          body={
            <Fragment>
              {t(
                'Create integrations that interact with Sentry using the REST API and webhooks. '
              )}
              <br />
              {tct('For more information [link: see our docs].', {
                link: (
                  <ExternalLink
                    href={platformEventLinkMap[PlatformEvents.DOCS]}
                    onClick={() => {
                      trackIntegrationAnalytics(PlatformEvents.DOCS, {
                        organization,
                        view: this.analyticsView,
                      });
                    }}
                  />
                ),
              })}
            </Fragment>
          }
          action={
            <ActionContainer>
              <ExampleIntegrationButton
                analyticsView={this.analyticsView}
                style={{marginRight: space(1)}}
              />
              <CreateIntegrationButton analyticsView={this.analyticsView} />
            </ActionContainer>
          }
        />
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

const ActionContainer = styled('div')`
  display: flex;
`;

export default withOrganization(OrganizationDeveloperSettings);
