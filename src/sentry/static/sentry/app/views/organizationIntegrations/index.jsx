import {Box} from 'grid-emotion';
import {compact, groupBy, keyBy} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import LoadingIndicator from 'app/components/loadingIndicator';
import MigrationWarnings from 'app/views/organizationIntegrations/migrationWarnings';
import ProviderRow from 'app/views/organizationIntegrations/providerRow';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

export default class OrganizationIntegrations extends AsyncComponent {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  // Some integrations require visiting a different website to add them. When
  // we come back to the tab we want to show our integrations as soon as we can.
  reloadOnVisible = true;
  shouldReloadOnVisible = true;

  getEndpoints() {
    let {orgId} = this.props.params;
    const query = {plugins: ['vsts', 'github', 'bitbucket']};

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integrations', `/organizations/${orgId}/integrations/`],
      ['plugins', `/organizations/${orgId}/plugins/`, {query}],
      ['unmigratableRepos', `/organizations/${orgId}/repos/?status=unmigratable`],
    ];
  }

  // State

  get enabledPlugins() {
    // List of slugs for each Plugin the Org/Project has currently enabled.
    return compact(this.state.plugins.map(plugin => plugin.enabled && plugin.slug));
  }

  get unmigratableReposByOrg() {
    // Group by [GitHub|BitBucket|VSTS] Org name
    return groupBy(this.state.unmigratableRepos, repo => repo.name.split('/')[0]);
  }

  get providers() {
    // Adds a list of `integrations` (installed Integration records)
    // for each Provider, as well as an `isInstalled` boolean denoting
    // when at least one Integration is present.
    return this.state.config.providers.map(provider => {
      const integrations = this.state.integrations.filter(
        i => i.provider.key == provider.key
      );
      const isInstalled = integrations.length > 0;

      return {
        ...provider,
        integrations,
        isInstalled,
      };
    });
  }

  // Actions

  onInstall = integration => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.integrations, i => i.id);

    // Mark this integration as newlyAdded if it didn't already exist, allowing
    // us to animate the element in.
    if (!keyedItems.hasOwnProperty(integration.id)) {
      integration.newlyAdded = true;
    }

    const integrations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
    this.setState({integrations});
  };

  onRemove = integration => {
    const {orgId} = this.props.params;

    const origIntegrations = [...this.state.integrations];

    const integrations = this.state.integrations.filter(i => i.id !== integration.id);
    this.setState({integrations});

    const options = {
      method: 'DELETE',
      error: () => {
        this.setState({integrations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
  };

  onDisable = integration => {
    let url;
    let [domainName, orgName] = integration.domainName.split('/');

    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  // Rendering

  renderBody() {
    const providers = this.providers.map(provider => (
      <ProviderRow
        key={provider.key}
        provider={provider}
        orgId={this.props.params.orgId}
        integrations={provider.integrations}
        onInstall={this.onInstall}
        onRemove={this.onRemove}
        onDisable={this.onDisable}
        onReinstall={this.onInstall}
        enabledPlugins={this.enabledPlugins}
      />
    ));

    return (
      <React.Fragment>
        {!this.props.hideHeader && <SettingsPageHeader title={t('Integrations')} />}

        <MigrationWarnings
          unmigratableRepos={this.unmigratableReposByOrg}
          providers={this.providers}
          onInstall={this.onInstall}
        />

        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Integrations')}
            </Box>
            {this.state.reloading && <StyledLoadingIndicator mini />}
          </PanelHeader>
          <PanelBody>{providers}</PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-16px);
`;
