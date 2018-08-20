import {Box, Flex} from 'grid-emotion';
import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {openIntegrationDetails} from 'app/actionCreators/modal';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import CircleIndicator from 'app/components/circleIndicator';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegration';
import Link from 'app/components/link';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

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

  // Actions

  openModal = () => {
    const provider = this.props.provider;
    const onAddIntegration = this.props.onInstall;
    openIntegrationDetails({provider, onAddIntegration});
  };

  // Rendering

  get buttonText() {
    let buttonText = this.isEnabled > 0 ? t('Add Another') : t('Install');
    return this.isEnabledPlugin ? t('Upgrade') : buttonText;
  }

  renderButton() {
    return (
      <Button icon="icon-circle-add" size="small" onClick={this.openModal}>
        {this.buttonText}
      </Button>
    );
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
              <Link onClick={this.openModal}>Learn More</Link>
            </ProviderDetails>
          </Box>
          <Box>{this.renderButton()}</Box>
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
      background: ${p => p.theme.yellowLightest};
    }
  }

  height: 0;
  overflow: hidden;
  animation: slidein 160ms 500ms ease-in-out forwards,
    highlight 1000ms 500ms ease-in-out forwards;
`;
