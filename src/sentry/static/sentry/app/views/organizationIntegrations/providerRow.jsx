import {Box, Flex} from 'grid-emotion';
import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {openIntegrationDetails} from 'app/actionCreators/modal';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegration';
import Link from 'app/components/link';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {growDown, highlight} from 'app/styles/animations';

export default class ProviderRow extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static propTypes = {
    // `provider` is expected to have a list of installed `integrations`.
    provider: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    onInstall: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onDisable: PropTypes.func.isRequired,
    onReinstall: PropTypes.func.isRequired,
    enabledPlugins: PropTypes.array,
  };

  static defaultProps = {
    enabledPlugins: [],
  };

  static upgradableIntegrations = ['vsts', 'bitbucket', 'github', 'github_enterprise'];

  // State

  get integrations() {
    return this.props.provider.integrations;
  }

  get isEnabled() {
    return this.integrations.length > 0;
  }

  get isEnabledPlugin() {
    return this.props.enabledPlugins.includes(this.props.provider.key);
  }

  get isUpgradable() {
    return ProviderRow.upgradableIntegrations.includes(this.props.provider.key);
  }

  // Actions

  openModal = () => {
    const organization = this.context.organization;
    const provider = this.props.provider;
    const onAddIntegration = this.props.onInstall;
    openIntegrationDetails({provider, organization, onAddIntegration});
  };

  // Rendering

  get buttonProps() {
    const upgradeable = !this.isEnabled && this.isEnabledPlugin && this.isUpgradable;

    return {
      icon: upgradeable ? 'icon-upgrade' : 'icon-circle-add',
      children: this.isEnabled
        ? t('Add Another')
        : upgradeable ? t('Update') : t('Install'),
    };
  }

  renderIntegrations() {
    return this.integrations.map(integration => (
      <StyledInstalledIntegration
        key={integration.id}
        orgId={this.props.orgId}
        provider={this.props.provider}
        integration={integration}
        onRemove={this.props.onRemove}
        onDisable={this.props.onDisable}
        onReinstallIntegration={this.props.onReinstall}
      />
    ));
  }

  render() {
    return (
      <PanelItem p={0} direction="column">
        <Flex align="center" p={2}>
          <PluginIcon size={36} pluginId={this.props.provider.key} />
          <Box px={2} flex={1}>
            <ProviderName>{this.props.provider.name}</ProviderName>
            <ProviderDetails>
              <Status enabled={this.isEnabled} />
              <StyledLink onClick={this.openModal}>Learn More</StyledLink>
            </ProviderDetails>
          </Box>
          <Box>
            <Button size="small" onClick={this.openModal} {...this.buttonProps} />
          </Box>
        </Flex>
        {this.renderIntegrations()}
      </PanelItem>
    );
  }
}

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
      <Flex align="center">
        <CircleIndicator size={6} color={enabled ? p.theme.success : p.theme.gray2} />
        <div {...p}>{enabled ? t('Installed') : t('Not Installed')}</div>
      </Flex>
    );
  })
)`
  color: ${p => (p.enabled ? p.theme.success : p.theme.gray2)};
  margin-left: ${space(0.5)};
  &:after {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-left: ${space(0.75)};
    font-weight: normal;
  }
  margin-right: ${space(0.75)};
`;

const NewInstallation = styled('div')`
  overflow: hidden;
  transform-origin: 0 auto;
  animation: ${growDown('59px')} 160ms 500ms ease-in-out forwards,
    ${p => highlight(p.theme.yellowLightest)} 1000ms 500ms ease-in-out forwards;
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
  border-top: 1px dashed ${p => p.theme.borderLight};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
`;
