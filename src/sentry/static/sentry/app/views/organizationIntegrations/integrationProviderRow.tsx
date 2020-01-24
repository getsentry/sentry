import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {openIntegrationDetails} from 'app/actionCreators/modal';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import InstalledIntegration, {
  Props as InstalledIntegrationProps,
} from 'app/views/organizationIntegrations/installedIntegration';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {growDown, highlight} from 'app/styles/animations';
import {IntegrationProvider, Integration} from 'app/types';

type Props = {
  provider: IntegrationProvider;
  orgId: string;
  onInstall: (integration: Integration) => void;
  onRemove: (integration: Integration) => void;
  onDisable: (integration: Integration) => void;
  onReinstall: (integration: Integration) => void;
  newlyInstalledIntegrationId: string;
  integrations: Integration[];
};

export default class ProviderRow extends React.Component<Props> {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    integrations: PropTypes.array.isRequired,
    orgId: PropTypes.string.isRequired,
    onInstall: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onDisable: PropTypes.func.isRequired,
    onReinstall: PropTypes.func.isRequired,
    newlyInstalledIntegrationId: PropTypes.string,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static upgradableIntegrations = ['vsts', 'bitbucket', 'github', 'github_enterprise'];

  get integrations() {
    return this.props.integrations;
  }

  get isEnabled() {
    return this.integrations.length > 0;
  }

  // Actions

  openModal = () => {
    const organization = this.context.organization;
    const provider = this.props.provider;
    const onAddIntegration = this.props.onInstall;
    openIntegrationDetails({
      provider,
      organization,
      onAddIntegration,
      isInstalled: this.isEnabled,
    });
  };

  // Rendering

  get buttonProps() {
    return {
      icon: 'icon-circle-add',
      children: this.isEnabled ? t('Add Configuration') : t('Install'),
    };
  }

  renderIntegrations() {
    return this.integrations.map(integration => (
      <StyledInstalledIntegration
        key={integration.id}
        organization={this.context.organization}
        provider={this.props.provider}
        integration={integration}
        onRemove={this.props.onRemove}
        onDisable={this.props.onDisable}
        onReinstallIntegration={this.props.onReinstall}
        data-test-id={integration.id}
        newlyAdded={integration.id === this.props.newlyInstalledIntegrationId}
      />
    ));
  }

  render() {
    return (
      <PanelItem p={0} flexDirection="column" data-test-id={this.props.provider.key}>
        <Flex style={{alignItems: 'center', padding: '16px'}}>
          <PluginIcon size={36} pluginId={this.props.provider.key} />
          <div style={{flex: '1', padding: '0 16px'}}>
            <ProviderName>{this.props.provider.name}</ProviderName>
            <ProviderDetails>
              <Status enabled={this.isEnabled} />
            </ProviderDetails>
          </div>
          <div>
            <Button size="small" onClick={this.openModal} {...this.buttonProps} />
          </div>
        </Flex>
      </PanelItem>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const ProviderName = styled('div')`
  font-weight: bold;
`;

const ProviderDetails = styled(Flex)`
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

type StatusProps = {
  enabled: boolean;
  theme?: any; //TS complains if we don't make this optional
};

const Status = styled(
  withTheme((props: StatusProps) => {
    const {enabled, theme, ...p} = props;
    return (
      <StatusWrapper>
        <CircleIndicator
          enabled={enabled}
          size={6}
          color={enabled ? theme.success : theme.gray2}
        />
        <div {...p}>{enabled ? t('Installed') : t('Not Installed')}</div>
      </StatusWrapper>
    );
  })
)`
  color: ${(p: StatusProps) => (p.enabled ? p.theme.success : p.theme.gray2)};
  margin-left: ${space(0.5)};
  margin-right: ${space(0.75)};
`;

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const NewInstallation = styled('div')`
  overflow: hidden;
  transform-origin: 0 auto;
  animation: ${growDown('59px')} 160ms 500ms ease-in-out forwards,
    ${p => highlight(p.theme.yellowLightest)} 1000ms 500ms ease-in-out forwards;
`;

const StyledInstalledIntegration = styled(
  (p: InstalledIntegrationProps & {newlyAdded: boolean}) =>
    p.newlyAdded ? (
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
