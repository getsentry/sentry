import {Fragment} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {RequestOptions} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Panel, PanelItem} from 'sentry/components/panels';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Integration, IntegrationProvider, ObjectStatus} from 'sentry/types';
import {getAlertText} from 'sentry/utils/integrationUtil';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import {AddIntegrationButton} from './addIntegrationButton';
import InstalledIntegration from './installedIntegration';

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
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    return this.state.information.providers[0];
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
    const {configurations} = this.state;
    if (
      configurations.filter(i => i.organizationIntegrationStatus === 'disabled').length
    ) {
      return 'Disabled';
    }
    return configurations.length ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return this.provider.name;
  }

  get featureData() {
    return this.metadata.features;
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
    const {organization} = this.props;
    const provider = this.provider;
    const {metadata} = provider;

    const size = 'sm' as const;
    const priority = 'primary' as const;

    const buttonProps = {
      style: {marginBottom: space(1)},
      size,
      priority,
      'data-test-id': 'install-button',
      disabled: disabledFromFeatures,
      organization,
    };

    if (!userHasAccess) {
      return this.renderRequestIntegrationButton();
    }

    if (provider.canAdd) {
      return (
        <AddIntegrationButton
          provider={provider}
          onAddIntegration={this.onInstall}
          analyticsParams={{
            view: 'integrations_directory_integration_detail',
            already_installed: this.installationStatus !== 'Not Installed',
          }}
          {...buttonProps}
        />
      );
    }
    if (metadata.aspects.externalInstall) {
      return (
        <Button
          icon={<IconOpen />}
          href={metadata.aspects.externalInstall.url}
          onClick={this.handleExternalInstall}
          external
          {...buttonProps}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      );
    }

    // This should never happen but we can't return undefined without some refactoring.
    return <Fragment />;
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
          <Alert type="warning" showIcon>
            {alertText}
          </Alert>
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
}

export default withOrganization(IntegrationDetailedView);
