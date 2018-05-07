import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Link from 'app/components/link';
import Button from 'app/components/buttons/button';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import theme from 'app/utils/theme';

const ProviderName = styled.div`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 3px;
`;

const TeamName = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 14px;
`;

export default class OrganizationIntegrations extends AsyncComponent {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  getEndpoints() {
    let {orgId} = this.props;
    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['organization', `/organizations/${orgId}/`],
    ];
  }

  renderBody() {
    let {orgId, projectId} = this.props;
    let orgFeatures = new Set(this.state.organization.features);
    let internalIntegrations = new Set(['jira', 'github']);

    const integrations = this.state.config.providers
      .filter(provider => {
        return (
          orgFeatures.has('internal-catchall') || !internalIntegrations.has(provider.key)
        );
      })
      .map(provider => (
        <PanelItem key={provider.key} align="center">
          <Box>
            <PluginIcon size={32} pluginId={provider.key} />
          </Box>
          <Box px={2} flex={1}>
            <ProviderName>
              <Link
                to={`/settings/${orgId}/${projectId}/integrations/${provider.key}/`}
                css={{color: theme.gray5}}
              >
                {provider.name}
              </Link>
            </ProviderName>
            <TeamName>{provider.metadata.author}</TeamName>
          </Box>
          <Box>
            <Button
              size="small"
              to={`/settings/${orgId}/${projectId}/integrations/${provider.key}/`}
            >
              {t('Configure')}
            </Button>
          </Box>
        </PanelItem>
      ));

    return (
      <Panel>
        <PanelHeader disablePadding={true}>
          <Box px={2} flex="1">
            {t('Global Integrations')}
          </Box>
        </PanelHeader>
        <PanelBody>{integrations}</PanelBody>
      </Panel>
    );
  }
}
