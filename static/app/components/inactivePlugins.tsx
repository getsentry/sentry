import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import {Plugin} from 'sentry/types';

type Props = {
  onEnablePlugin: (plugin: Plugin) => void;
  plugins: Plugin[];
};

function InactivePlugins({plugins, onEnablePlugin}: Props) {
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

const IntegrationButton = styled('button')`
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
