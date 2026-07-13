import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconAdd, IconDelete, IconRefresh} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';

import {
  ConnectorStatus,
  type ConnectorStatusType,
} from 'getsentry/views/seerAutomation/components/connectorStatus';
import type {MonitoringProvider} from 'getsentry/views/seerAutomation/connectors';

// TODO(CW-1583): currently we show only Connected or Not Connected (the backend does not give us more information than this)
function getConnectorStatus(provider: MonitoringProvider): ConnectorStatusType {
  return provider.connected ? 'connected' : 'not_connected';
}

interface ConnectorRowProps {
  isConnecting: boolean;
  isDisconnecting: boolean;
  isReconnecting: boolean;
  onConnect: (provider: MonitoringProvider) => void;
  onDisconnect: (provider: MonitoringProvider) => void;
  onReconnect: (provider: MonitoringProvider) => void;
  provider: MonitoringProvider;
}

export function ConnectorRow({
  provider,
  onConnect,
  onReconnect,
  onDisconnect,
  isConnecting,
  isReconnecting,
  isDisconnecting,
}: ConnectorRowProps) {
  const status = getConnectorStatus(provider);
  const pluginId = provider.provider;

  return (
    <PanelItem center>
      <Flex align="center" gap="md" flex="1">
        <PluginIcon size={36} pluginId={pluginId} />
        <Stack>
          <Text bold>{provider.name}</Text>
          <ConnectorStatus status={status} />
        </Stack>
      </Flex>
      {status === 'connected' ? (
        <Button
          variant="transparent"
          size="sm"
          icon={<IconDelete />}
          onClick={() => onDisconnect(provider)}
          busy={isDisconnecting}
        >
          {t('Disconnect')}
        </Button>
      ) : status === 'failed' || status === 'expired' ? (
        <Button
          variant="primary"
          size="sm"
          icon={<IconRefresh />}
          onClick={() => onReconnect(provider)}
          busy={isReconnecting}
        >
          {t('Reconnect')}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon={<IconAdd />}
          onClick={() => onConnect(provider)}
          busy={isConnecting}
        >
          {t('Connect')}
        </Button>
      )}
    </PanelItem>
  );
}
