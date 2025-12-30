import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface PluginConfigProps {
  plugin: Plugin;
  project: Project;
  enabled?: boolean;
  onDisablePlugin?: (data: Plugin) => void;
}

export default function PluginConfig({
  plugin,
  project,
  enabled,
  onDisablePlugin,
}: PluginConfigProps) {
  const api = useApi();
  const organization = useOrganization();
  // If passed via props, use that value instead of from `data`
  const isEnabled = typeof enabled === 'undefined' ? plugin.enabled : enabled;
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const [testResults, setTestResults] = useState('');
  const [isPluginLoading, setIsPluginLoading] = useState(!plugins.isLoaded(plugin));
  const loadingPluginIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Avoid loading the same plugin multiple times
    if (!plugins.isLoaded(plugin) && loadingPluginIdRef.current !== plugin.id) {
      setIsPluginLoading(true);
      loadingPluginIdRef.current = plugin.id;
      plugins.load(plugin, () => {
        setIsPluginLoading(false);
      });
    }
  }, [plugin]);

  const handleTestPlugin = async () => {
    setTestResults('');
    addLoadingMessage(t('Sending test...'));

    try {
      const pluginEndpointData = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
        {
          method: 'POST',
          data: {
            test: true,
          },
        }
      );

      setTestResults(JSON.stringify(pluginEndpointData.detail));
      addSuccessMessage(t('Test Complete!'));
    } catch (_err) {
      addErrorMessage(
        t('An unexpected error occurred while testing your plugin. Please try again.')
      );
    }
  };

  const handleDisablePlugin = () => {
    onDisablePlugin?.(plugin);
  };

  return (
    <Panel
      className={`plugin-config ref-plugin-config-${plugin.id}`}
      data-test-id="plugin-config"
    >
      <PanelHeader hasButtons>
        <Flex align="center" flex="1">
          <StyledPluginIcon pluginId={plugin.id} />
          <span>{plugin.name}</span>
        </Flex>

        {plugin.canDisable && isEnabled && (
          <ButtonBar>
            {plugin.isTestable && (
              <Button onClick={handleTestPlugin} size="xs">
                {t('Test Plugin')}
              </Button>
            )}
            <Button size="xs" onClick={handleDisablePlugin} disabled={!hasWriteAccess}>
              {t('Disable')}
            </Button>
          </ButtonBar>
        )}
      </PanelHeader>

      {plugin.status === 'beta' && (
        <PanelAlert variant="warning">
          {t('This plugin is considered beta and may change in the future.')}
        </PanelAlert>
      )}

      {testResults !== '' && (
        <PanelAlert variant="info">
          <strong>Test Results</strong>
          <div>{testResults}</div>
        </PanelAlert>
      )}

      <StyledPanelBody>
        <div dangerouslySetInnerHTML={{__html: plugin.doc}} />
        {isPluginLoading ? (
          <LoadingIndicator />
        ) : (
          plugins.get(plugin).renderSettings({
            organization,
            project,
          })
        )}
      </StyledPanelBody>
    </Panel>
  );
}

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: ${space(1)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
  padding-bottom: 0;
`;
