import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import AsyncComponent from '../../components/asyncComponent';
import Link from '../../components/link';
import Panel from '../settings/components/panel';
import PanelBody from '../settings/components/panelBody';
import PanelHeader from '../settings/components/panelHeader';
import PluginIcon from '../../plugins/components/pluginIcon';
import PanelItem from '../settings/components/panelItem';
import theme from '../../utils/theme';

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
    return [['config', `/organizations/${orgId}/config/integrations/`]];
  }

  renderBody() {
    let {orgId, projectId} = this.props;

    const integrations = this.state.config.providers.map(provider => (
      <PanelItem key={provider.key}>
        <Box>
          <PluginIcon size={32} pluginId={provider.key} />
        </Box>
        <Box px={2} flex={1}>
          <ProviderName>
            <Link
              to={`/settings/organization/${orgId}/project/${projectId}/integrations/${provider.key}/`}
              css={{color: theme.gray5}}
            >
              {provider.name}
            </Link>
          </ProviderName>
          <TeamName>{provider.metadata.author}</TeamName>
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
