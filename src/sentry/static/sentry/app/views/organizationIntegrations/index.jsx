import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import Link from 'app/components/link';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import theme from 'app/utils/theme';

const ProviderName = styled.div`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 3px;
`;

const AuthorName = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 14px;
`;

export default class OrganizationIntegrations extends AsyncComponent {
  static propTypes = {
    linkPrefix: PropTypes.string,
    hideHeader: PropTypes.bool,
  };

  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['organization', `/organizations/${orgId}/`],
    ];
  }

  renderBody() {
    let {location} = this.props;
    let orgFeatures = new Set(this.state.organization.features);
    let internalIntegrations = new Set(['jira']);

    const linkPrefix = this.props.linkPrefix ? this.props.linkPrefix : location.pathname;

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
              <Link to={`${linkPrefix}${provider.key}/`} css={{color: theme.gray5}}>
                {provider.name}
              </Link>
            </ProviderName>
            <AuthorName>{provider.metadata.author}</AuthorName>
          </Box>
          <Box>
            <Button size="small" to={`${linkPrefix}${provider.key}/`}>
              {t('Manage')}
            </Button>
          </Box>
        </PanelItem>
      ));

    return (
      <React.Fragment>
        {!this.props.hideHeader && <SettingsPageHeader title={t('Integrations')} />}
        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Integrations')}
            </Box>
          </PanelHeader>
          <PanelBody>{integrations}</PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}
