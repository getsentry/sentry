import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../locale';
import Panel from '../views/settings/components/panel';
import PanelBody from '../views/settings/components/panelBody';
import PanelHeader from '../views/settings/components/panelHeader';
import PluginIcon from '../plugins/components/pluginIcon';
import TextOverflow from './textOverflow';

const IntegrationButton = styled.button`
  width: 175px;
  text-align: center;
  font-size: 12px;
  color: #889ab0;
  letter-spacing: 0.1px;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid #eee;
  background: inherit;
  border-radius: 4px;
  padding: 10px;

  &:hover {
    border-color: #ccc;
  }
`;

class InactivePlugins extends React.Component {
  static propTypes = {
    plugins: PropTypes.array.isRequired,
    onEnablePlugin: PropTypes.func.isRequired,
  };

  enablePlugin = plugin => {
    return this.props.onEnablePlugin(plugin, true);
  };

  render() {
    let plugins = this.props.plugins;
    if (plugins.length === 0) return null;
    return (
      <Panel>
        <PanelHeader>{t('Inactive Integrations')}</PanelHeader>

        <PanelBody>
          <Flex p={1} flex="1" wrap="wrap">
            {plugins.map(plugin => {
              return (
                <Box m={1} key={plugin.id}>
                  <IntegrationButton
                    onClick={this.enablePlugin.bind(this, plugin)}
                    className={`ref-plugin-enable-${plugin.id}`}
                  >
                    <Flex justify="center" align="center">
                      <Flex align="center" mr={1}>
                        <PluginIcon pluginId={plugin.id} />
                      </Flex>
                      <TextOverflow>{plugin.shortName || plugin.name}</TextOverflow>
                    </Flex>
                  </IntegrationButton>
                </Box>
              );
            })}
          </Flex>
        </PanelBody>
      </Panel>
    );
  }
}

export default InactivePlugins;
