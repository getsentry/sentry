import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {RequestOptions} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert/alert';
import type DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {Data, JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ObjectStatus} from 'sentry/types/core';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getAlertText, getIntegrationStatus} from 'sentry/utils/integrationUtil';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import type {Tab} from './abstractIntegrationDetailedView';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import InstalledIntegration from './installedIntegration';

// Show the features tab if the org has features for the integration
const integrationFeatures = ['github', 'slack'];

const FirstPartyIntegrationAlert = HookOrDefault({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null,
});

const FirstPartyIntegrationAdditionalCTA = HookOrDefault({
  hookName: 'component:first-party-integration-additional-cta',
  defaultComponent: () => null,
});

type State = {
  configurations: Integration[];
  information: {providers: IntegrationProvider[]};
};

class IntegrationDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  tabs: Tab[] = ['overview', 'configurations', 'features'];

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {integrationSlug} = this.props.params;
    return [
      [
        'information',
        `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`,
      ],
      [
        'configurations',
        `/organizations/${organization.slug}/integrations/?provider_key=${integrationSlug}&includeConfig=0`,
      ],
    ];
  }

  get integrationType() {
    return 'first_party' as const;
  }

  get provider() {
    return this.state.information.providers[0]!;
  }

  get description() {
    return this.metadata.description;
  }

  get author() {
    return this.metadata.author;
  }

  get alerts() {
    const provider = this.provider;
    const metadata = this.metadata;
    // The server response for integration installations includes old icon CSS classes
    // We map those to the currently in use values to their react equivalents
    // and fallback to IconFlag just in case.
    const alerts = (metadata.aspects.alerts || []).map(item => ({
      ...item,
      showIcon: true,
    }));

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        showIcon: true,
        text: metadata.aspects.externalInstall.noticeText,
      });
    }
    return alerts;
  }

  get resourceLinks() {
    const metadata = this.metadata;
    return [
      {url: metadata.source_url, title: 'View Source'},
      {url: metadata.issue_url, title: 'Report Issue'},
    ];
  }

  get metadata() {
    return this.provider.metadata;
  }

  get isEnabled() {
    return this.state.configurations.length > 0;
  }

  get installationStatus() {
    // TODO: add transations
    const {configurations} = this.state;
    const statusList = configurations.map(getIntegrationStatus);
    // if we have conflicting statuses, we have a priority order
    if (statusList.includes('active')) {
      return 'Installed';
    }
    if (statusList.includes('disabled')) {
      return 'Disabled';
    }
    if (statusList.includes('pending_deletion')) {
      return 'Pending Deletion';
    }
    return 'Not Installed';
  }

  get integrationName() {
    return this.provider.name;
  }

  get featureData() {
    return this.metadata.features;
  }

  renderTabs() {
    // TODO: Convert to styled component
    const tabs = integrationFeatures.includes(this.provider.key)
      ? this.tabs
      : this.tabs.filter(tab => tab !== 'features');

    return (
      <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
        {tabs.map(tabName => (
          <li
            key={tabName}
            className={this.state.tab === tabName ? 'active' : ''}
            onClick={() => this.onTabChange(tabName)}
          >
            <CapitalizedLink>{this.getTabDisplay(tabName)}</CapitalizedLink>
          </li>
        ))}
      </ul>
    );
  }

  onInstall = (integration: Integration) => {
    // send the user to the configure integration view for that integration
    const {organization} = this.props;
    this.props.router.push(
      normalizeUrl(
        `/settings/${organization.slug}/integrations/${integration.provider.key}/${integration.id}/`
      )
    );
  };

  onRemove = (integration: Integration) => {
    const {organization} = this.props;

    const origIntegrations = [...this.state.configurations];

    const integrations = this.state.configurations.map(i =>
      i.id === integration.id
        ? {...i, organizationIntegrationStatus: 'pending_deletion' as ObjectStatus}
        : i
    );

    this.setState({configurations: integrations});

    const options: RequestOptions = {
      method: 'DELETE',
      error: () => {
        this.setState({configurations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(
      `/organizations/${organization.slug}/integrations/${integration.id}/`,
      options
    );
  };

  onDisable = (integration: Integration) => {
    let url: string;

    if (!integration.domainName) {
      return;
    }

    const [domainName, orgName] = integration.domainName.split('/');
    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  handleExternalInstall = () => {
    this.trackIntegrationAnalytics('integrations.installation_start');
  };

  renderAlert() {
    return (
      <FirstPartyIntegrationAlert
        integrations={this.state.configurations ?? []}
        hideCTA
      />
    );
  }

  renderAdditionalCTA() {
    return (
      <FirstPartyIntegrationAdditionalCTA
        integrations={this.state.configurations ?? []}
      />
    );
  }

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    const provider = this.provider;
    const location = this.props.location;
    const queryParams = new URLSearchParams(location.search);
    const referrer = queryParams.get('referrer');

    const buttonProps = {
      size: 'sm',
      priority: 'primary',
      'data-test-id': 'install-button',
      disabled: disabledFromFeatures,
    };

    return (
      <IntegrationContext.Provider
        value={{
          provider,
          type: this.integrationType,
          installStatus: this.installationStatus,
          analyticsParams: {
            view: 'integrations_directory_integration_detail',
            already_installed: this.installationStatus !== 'Not Installed',
            ...(referrer && {referrer}),
          },
        }}
      >
        <StyledIntegrationButton
          userHasAccess={userHasAccess}
          onAddIntegration={this.onInstall}
          onExternalClick={this.handleExternalInstall}
          buttonProps={buttonProps}
        />
      </IntegrationContext.Provider>
    );
  }

  renderConfigurations() {
    const {configurations} = this.state;
    const {organization} = this.props;
    const provider = this.provider;

    if (!configurations.length) {
      return this.renderEmptyConfigurations();
    }

    const alertText = getAlertText(configurations);

    return (
      <Fragment>
        {alertText && (
          <Alert.Container>
            <Alert type="warning" showIcon>
              {alertText}
            </Alert>
          </Alert.Container>
        )}
        <Panel>
          {configurations.map(integration => (
            <PanelItem key={integration.id}>
              <InstalledIntegration
                organization={organization}
                provider={provider}
                integration={integration}
                onRemove={this.onRemove}
                onDisable={this.onDisable}
                data-test-id={integration.id}
                trackIntegrationAnalytics={this.trackIntegrationAnalytics}
                requiresUpgrade={!!alertText}
              />
            </PanelItem>
          ))}
        </Panel>
      </Fragment>
    );
  }

  getSlackFeatures(): [JsonFormObject[], Data] {
    const {configurations} = this.state;
    const {organization} = this.props;
    const hasIntegration = configurations ? configurations.length > 0 : false;

    const forms: JsonFormObject[] = [
      {
        fields: [
          {
            name: 'issueAlertsThreadFlag',
            type: 'boolean',
            label: t('Enable Slack threads on Issue Alerts'),
            help: t(
              'Allow Slack integration to post replies in threads for an Issue Alert notification.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a Slack integration to enable this feature.'
            ),
          },
          {
            name: 'metricAlertsThreadFlag',
            type: 'boolean',
            label: t('Enable Slack threads on Metric Alerts'),
            help: t(
              'Allow Slack integration to post replies in threads for an Metric Alert notification.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a Slack integration to enable this feature.'
            ),
          },
        ],
      },
    ];

    const initialData = {
      issueAlertsThreadFlag: organization.issueAlertsThreadFlag,
      metricAlertsThreadFlag: organization.metricAlertsThreadFlag,
    };

    return [forms, initialData];
  }

  getGithubFeatures(): [JsonFormObject[], Data] {
    const {configurations} = this.state;
    const {organization} = this.props;
    const hasIntegration = configurations ? configurations.length > 0 : false;

    const forms: JsonFormObject[] = [
      {
        fields: [
          {
            name: 'githubPRBot',
            type: 'boolean',
            label: t('Enable Comments on Suspect Pull Requests'),
            help: t(
              'Allow Sentry to comment on recent pull requests suspected of causing issues.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitHub integration to enable this feature.'
            ),
          },
          {
            name: 'githubOpenPRBot',
            type: 'boolean',
            label: t('Enable Comments on Open Pull Requests'),
            help: t(
              'Allow Sentry to comment on open pull requests to show recent error issues for the code being changed.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitHub integration to enable this feature.'
            ),
          },
          {
            name: 'githubNudgeInvite',
            type: 'boolean',
            label: t('Enable Missing Member Detection'),
            help: t(
              'Allow Sentry to detect users committing to your GitHub repositories that are not part of your Sentry organization..'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitHub integration to enable this feature.'
            ),
          },
        ],
      },
    ];

    const initialData = {
      githubPRBot: organization.githubPRBot,
      githubOpenPRBot: organization.githubOpenPRBot,
      githubNudgeInvite: organization.githubNudgeInvite,
    };

    return [forms, initialData];
  }

  renderFeatures() {
    const {organization} = this.props;
    const endpoint = `/organizations/${organization.slug}/`;
    const hasOrgWrite = organization.access.includes('org:write');

    let forms: JsonFormObject[], initialData: Data;
    switch (this.provider.key) {
      case 'github': {
        [forms, initialData] = this.getGithubFeatures();
        break;
      }
      case 'slack': {
        [forms, initialData] = this.getSlackFeatures();
        break;
      }
      default:
        return null;
    }

    return (
      <Form
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm
          disabled={!hasOrgWrite}
          features={organization.features}
          forms={forms}
        />
      </Form>
    );
  }

  renderBody() {
    return (
      <Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={this.integrationName} />
        {this.renderAlert()}
        {this.renderTopSection()}
        {this.renderTabs()}
        {this.state.tab === 'overview'
          ? this.renderInformationCard()
          : this.state.tab === 'configurations'
            ? this.renderConfigurations()
            : this.renderFeatures()}
      </Fragment>
    );
  }
}

export default withOrganization(IntegrationDetailedView);
const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;

const StyledIntegrationButton = styled(IntegrationButton)`
  margin-bottom: ${space(1)};
`;
