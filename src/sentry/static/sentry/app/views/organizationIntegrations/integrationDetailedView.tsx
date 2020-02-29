import React from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import {Integration, IntegrationProvider} from 'app/types';
import {RequestOptions} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Button from 'app/components/button';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegrationInDirectory';
import withOrganization from 'app/utils/withOrganization';
import {sortArray} from 'app/utils';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';

type State = {
  configurations: Integration[];
  information: {providers: IntegrationProvider[]};
};

class IntegrationDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, integrationSlug} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      [
        'information',
        `/organizations/${orgId}/config/integrations/?provider_key=${integrationSlug}`,
      ],
      [
        'configurations',
        `/organizations/${orgId}/integrations/?provider_key=${integrationSlug}`,
      ],
    ];

    return baseEndpoints;
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
    const alerts = metadata.aspects.alerts || [];

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        icon: 'icon-exit',
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
    return this.isEnabled ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return this.provider.name;
  }

  get featureData() {
    return this.metadata.features;
  }

  onInstall = (integration: Integration) => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.configurations, i => i.id);

    const configurations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
    this.setState({configurations});
  };

  onRemove = (integration: Integration) => {
    const {orgId} = this.props.params;

    const origIntegrations = [...this.state.configurations];

    const integrations = this.state.configurations.filter(i => i.id !== integration.id);
    this.setState({configurations: integrations});

    const options: RequestOptions = {
      method: 'DELETE',
      error: () => {
        this.setState({configurations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
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
    this.trackIntegrationEvent({
      eventKey: 'integrations.installation_start',
      eventName: 'Integrations: Installation Start',
    });
  };

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    const {organization} = this.props;
    const provider = this.provider;
    const {metadata} = provider;

    const size = 'small' as const;
    const priority = 'primary' as const;

    const buttonProps = {
      style: {marginLeft: space(1)},
      size,
      priority,
      'data-test-id': 'add-button',
      disabled: disabledFromFeatures || !userHasAccess,
      organization,
    };

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
          icon="icon-exit"
          href={metadata.aspects.externalInstall.url}
          onClick={this.handleExternalInstall}
          external
          {...buttonProps}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      );
    }
    //should never happen but we can't return undefined without some refactoring
    return <span />;
  }

  renderConfigurations() {
    const {configurations} = this.state;
    const {organization} = this.props;
    const provider = this.provider;
    if (configurations.length) {
      return (
        <div>
          {configurations.map(integration => (
            <InstallWrapper key={integration.id}>
              <InstalledIntegration
                organization={organization}
                provider={provider}
                integration={integration}
                onRemove={this.onRemove}
                onDisable={this.onDisable}
                onReinstallIntegration={this.onInstall}
                data-test-id={integration.id}
                trackIntegrationEvent={this.trackIntegrationEvent}
              />
            </InstallWrapper>
          ))}
        </div>
      );
    }
    return this.renderEmptyConfigurations();
  }
}

const InstallWrapper = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.borderLight};
  border-bottom: none;
  background-color: white;

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

export default withOrganization(IntegrationDetailedView);
