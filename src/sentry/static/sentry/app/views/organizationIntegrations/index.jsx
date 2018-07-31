import {Box, Flex} from 'grid-emotion';
import {keyBy} from 'lodash';
import {withTheme} from 'emotion-theming';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {openIntegrationDetails} from 'app/actionCreators/modal';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import CircleIndicator from 'app/components/circleIndicator';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegration';
import Link from 'app/components/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';

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
    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integrations', `/organizations/${orgId}/integrations/`],
    ];
  }

  mergeIntegration = integration => {
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

  handleDeleteIntegration = integration => {
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

  handleDisableIntegration = integration => {
    let url;
    let [domainName, orgName] = integration.domainName.split('/');

    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations`;
    }
    window.open(url, '_blank');
  };

  renderBody() {
    const {orgId} = this.props.params;

    const integrations = this.state.config.providers.map(provider => {
      const installed = this.state.integrations
        .filter(i => i.provider.key === provider.key)
        .map(integration => (
          <StyledInstalledIntegration
            key={integration.id}
            orgId={orgId}
            provider={provider}
            integration={integration}
            onRemove={this.handleDeleteIntegration}
            onDisable={this.handleDisableIntegration}
            onReinstallIntegration={this.mergeIntegration}
          />
        ));

      const openModal = () =>
        openIntegrationDetails({
          provider,
          onAddIntegration: this.mergeIntegration,
        });

      return (
        <React.Fragment key={provider.key}>
          <PanelItem p={0} direction="column">
            <Flex align="center" p={2}>
              <PluginIcon size={36} pluginId={provider.key} />
              <Box px={2} flex={1}>
                <ProviderName>{provider.name}</ProviderName>
                <ProviderDetails>
                  <Status enabled={installed.length > 0} />
                  <Link onClick={openModal}>Learn More</Link>
                </ProviderDetails>
              </Box>
              <Box>
                <Button icon="icon-circle-add" size="small" onClick={openModal}>
                  {installed.length > 0 ? t('Add Another') : t('Install')}
                </Button>
              </Box>
            </Flex>
            {installed.length > 0 && installed}
          </PanelItem>
        </React.Fragment>
      );
    });

    return (
      <React.Fragment>
        {!this.props.hideHeader && <SettingsPageHeader title={t('Integrations')} />}
        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Integrations')}
            </Box>
            {this.state.reloading && <StyledLoadingIndicator mini />}
          </PanelHeader>
          <PanelBody>{integrations}</PanelBody>
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

const ProviderName = styled('div')`
  font-weight: bold;
`;

const ProviderDetails = styled(Flex)`
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const Status = styled(
  withTheme(props => {
    const {enabled, ...p} = props;
    return (
      <React.Fragment>
        <CircleIndicator size={6} color={enabled ? p.theme.success : p.theme.gray2} />
        <div {...p}>{enabled ? t('Installed') : t('Not Installed')}</div>
      </React.Fragment>
    );
  })
)`
  color: ${p => (p.enabled ? p.theme.success : p.theme.gray2)};
  margin-left: 5px;
  margin-right: 10px;
`;

const NewInstallation = styled('div')`
  @keyframes slidein {
    from {
      height: 0;
    }
    to {
      height: 59px;
    }
  }
  @keyframes highlight {
    0%,
    100% {
      height: rgba(255, 255, 255, 0);
    }

    25% {
      background: ${p => p.theme.yellowLight};
    }
  }

  height: 0;
  overflow: hidden;
  animation: slidein 160ms 500ms ease-in-out forwards,
    highlight 1000ms 500ms ease-in-out forwards;
`;

const StyledInstalledIntegration = styled(
  p =>
    p.integration.newlyAdded ? (
      <NewInstallation>
        <InstalledIntegration {...p} />
      </NewInstallation>
    ) : (
      <InstalledIntegration {...p} />
    )
)`
  padding: ${space(2)};
  padding-left: 0;
  margin-left: 68px;
  border-top: 1px dotted ${p => p.theme.borderLight};
`;
