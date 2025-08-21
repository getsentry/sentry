import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

export function ToolConnectCard({config, integration, className}: any) {
  if (!config || !integration) {
    return null;
  }
  return (
    <ToolConnectCardContainer className={className}>
      <ToolIcon config={config} integration={integration} />
      <Flex direction="column" gap="sm">
        <Text bold size="sm">
          {getConfigCardHeader({config, integration})}
        </Text>
        <Text variant="muted" size="sm">
          {getConfigCardDescription({config, integration})}
        </Text>
      </Flex>
    </ToolConnectCardContainer>
  );
}

function getConfigCardHeader({config, integration}: any): string {
  switch (config.integrationKey) {
    case 'pagerduty':
      return config.service?.label || 'PagerDuty Service';
    case 'jira':
      return `${config.project?.code} - ${config.project?.name}`;
    case 'slack':
      return integration.name;
    case 'statuspage':
      return config.statuspage?.headline || 'StatusPage';
    case 'notion':
      return config.database?.title?.plain_text || 'Notion Database';
    default:
      return 'Integration';
  }
}

function getConfigCardDescription({config, integration}: any): string | null {
  switch (config.integrationKey) {
    case 'pagerduty':
      return config.service?.value ? `Service ID: ${config.service.value}` : null;
    case 'jira':
      return config.project?.id ? `Project ID: ${config.project.id}` : null;
    case 'slack':
      return integration.domainName;
    case 'statuspage':
      return config.statuspage?.url || null;
    case 'notion':
      return config.database?.url || null;
    default:
      return null;
  }
}

function ToolIcon({config, integration}: any): React.ReactNode {
  switch (config.integrationKey) {
    case 'statuspage':
      return (
        <img
          style={{width: '24px', height: '24px'}}
          src={config.statuspage?.favicon_logo?.url}
        />
      );
    case 'notion':
      return (
        <img
          style={{width: '24px', height: '24px'}}
          src={config.database?.icon?.external?.url}
        />
      );
    case 'slack':
      return <img style={{width: '24px', height: '24px'}} src={integration.icon} />;
    default:
      return <PluginIcon pluginId={config.integrationKey} />;
  }
}

const ToolConnectCardContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.graphics.success};
  border-radius: ${p => p.theme.borderRadius};
  align-self: flex-start;
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  justify-content: center;
  z-index: 1;
  background: ${p => p.theme.background};
`;
