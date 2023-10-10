import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import {Plugin} from 'sentry/types';

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
              <Label>
                <StyledPluginIcon pluginId={plugin.id} />
                <TextOverflow>{plugin.shortName || plugin.name}</TextOverflow>
              </Label>
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
  margin: ${space(1)};
  width: 175px;
  text-align: center;
  font-size: ${p => p.theme.fontSizeSmall};
  color: #889ab0;
  letter-spacing: 0.1px;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid #eee;
  background: inherit;
  border-radius: ${p => p.theme.borderRadius};
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
