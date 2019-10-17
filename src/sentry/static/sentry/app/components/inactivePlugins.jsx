import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

class InactivePlugins extends React.Component {
  static propTypes = {
    plugins: PropTypes.array.isRequired,
    onEnablePlugin: PropTypes.func.isRequired,
  };

  enablePlugin = plugin => {
    return this.props.onEnablePlugin(plugin, true);
  };

  render() {
    const plugins = this.props.plugins;
    if (plugins.length === 0) {
      return null;
    }
    return (
      <Panel>
        <PanelHeader>{t('Inactive Integrations')}</PanelHeader>

        <PanelBody>
          <Plugins>
            {plugins.map(plugin => {
              return (
                <IntegrationButton
                  key={plugin.id}
                  onClick={this.enablePlugin.bind(this, plugin)}
                  className={`ref-plugin-enable-${plugin.id}`}
                >
                  <Label>
                    <StyledPluginIcon pluginId={plugin.id} />
                    <TextOverflow>{plugin.shortName || plugin.name}</TextOverflow>
                  </Label>
                </IntegrationButton>
              );
            })}
          </Plugins>
        </PanelBody>
      </Panel>
    );
  }
}

const Plugins = styled('div')`
  display: flex;
  padding: ${space(1)};
  flex: 1;
  flex-wrap: wrap;
`;

const IntegrationButton = styled('button')`
  margin: ${space(1)};
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

const Label = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: ${space(1)};
`;

export default InactivePlugins;
