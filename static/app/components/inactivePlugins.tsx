import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Plugin} from 'sentry/types/integrations';

type Props = {
  onEnablePlugin: (plugin: Plugin) => void;
  plugins: Plugin[];
  disabled?: boolean;
};

function InactivePlugins({disabled, plugins, onEnablePlugin}: Props) {
  if (plugins.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>{t('Inactive Integrations')}</PanelHeader>

      <PanelBody>
        <Plugins>
          {plugins.map(plugin => (
            <IntegrationButton
              disabled={disabled}
              title={
                disabled ? t('You do not have permission to set up an integration.') : ''
              }
              key={plugin.id}
              onClick={() => onEnablePlugin(plugin)}
              className={`ref-plugin-enable-${plugin.id}`}
            >
              <Flex align="center" justify="center" gap={space(1)}>
                <PluginIcon pluginId={plugin.id} />
                <TextOverflow>{plugin.shortName || plugin.name}</TextOverflow>
              </Flex>
            </IntegrationButton>
          ))}
        </Plugins>
      </PanelBody>
    </Panel>
  );
}

const Plugins = styled('div')`
  display: flex;
  padding: ${space(1)};
  flex: 1;
  flex-wrap: wrap;
`;

const IntegrationButton = styled(Button)`
  text-align: center;
  text-transform: uppercase;
  min-width: 175px;
  margin: ${space(1)};
`;

export default InactivePlugins;
