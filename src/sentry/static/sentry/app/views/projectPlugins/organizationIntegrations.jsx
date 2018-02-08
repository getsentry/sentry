import {Flex, Box} from 'grid-emotion';
import React from 'react';

import {t} from '../../locale';
import AsyncComponent from '../../components/asyncComponent';
import Panel from '../settings/components/panel';
import PanelBody from '../settings/components/panelBody';
import PanelHeader from '../settings/components/panelHeader';
import Row from '../settings/components/row';
import PluginIcon from '../../plugins/components/pluginIcon';
import Link from '../../components/link';

export default class OrganizationIntegrations extends AsyncComponent {
  // TODO: proptypes

  getEndpoints() {
    let {orgId} = this.props.params;

    return [['config', `/organizations/${orgId}/config/integrations/`]];
  }

  renderBody() {
    // TODO: This is for sure being passsed in to many things
    let {orgId, projectId} = this.props.params;

    console.log(this.props.params);

    return (
      <Panel>
        <PanelHeader disablePadding={true}>
          <Box px={2} flex="1">
            {t('Global Integrations')}
          </Box>
        </PanelHeader>
        <PanelBody>
          {this.state.config.providers.map(provider => {
            return (
              <Row key={provider.key}>
                <Box pr={1}>
                  <PluginIcon size={24} pluginId={provider.key} />
                </Box>
                <Box py={1 / 2} flex={1}>
                  <Link
                    to={`/settings/organization/${orgId}/project/${projectId}/integrations/${provider.key}/`}
                  >
                    {provider.name}
                  </Link>
                </Box>
              </Row>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}
