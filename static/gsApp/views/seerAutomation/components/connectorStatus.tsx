import {useTheme, type Theme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import {t} from 'sentry/locale';

export type ConnectorStatusType = 'connected' | 'not_connected' | 'failed' | 'expired';

const STATUS_COLORS = {
  connected: 'success',
  not_connected: 'secondary',
  failed: 'danger',
  expired: 'warning',
} as const satisfies Record<ConnectorStatusType, keyof Theme['tokens']['content']>;

const STATUS_LABELS: Record<ConnectorStatusType, string> = {
  connected: t('Connected'),
  not_connected: t('Not Connected'),
  failed: t('Failed'),
  expired: t('Expired'),
};

interface ConnectorStatusProps {
  status: ConnectorStatusType;
}

export function ConnectorStatus({status}: ConnectorStatusProps) {
  const theme = useTheme();
  const variant = STATUS_COLORS[status];

  return (
    <Flex align="center" gap="xs">
      <CircleIndicator size={6} color={theme.tokens.content[variant]} />
      <Text variant={variant}>{STATUS_LABELS[status]}</Text>
    </Flex>
  );
}
