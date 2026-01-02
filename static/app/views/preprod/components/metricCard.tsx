import type {CSSProperties, ReactNode} from 'react';

import {Button} from '@sentry/scraps/button/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

interface MetricCardAction {
  ariaLabel: string;
  icon: ReactNode;
  onClick: () => void;
  tooltip: ReactNode;
}

interface MetricCardProps {
  children: ReactNode;
  icon: ReactNode;
  label: string;
  labelTooltip: ReactNode;
  action?: MetricCardAction;
  style?: CSSProperties;
}

export function MetricCard(props: MetricCardProps) {
  const {icon, label, labelTooltip, action, children, style} = props;

  return (
    <Stack
      background="primary"
      radius="lg"
      padding="xl"
      gap="xs"
      border="primary"
      flex="1"
      style={style}
      minWidth="300px"
    >
      <Flex align="center" justify="between" gap="sm">
        <Flex gap="sm" align="center">
          {icon}
          {labelTooltip ? (
            <Tooltip title={labelTooltip}>
              <Text variant="muted" size="sm" bold uppercase>
                {label}
              </Text>
            </Tooltip>
          ) : (
            <Text variant="muted" size="sm" bold uppercase>
              {label}
            </Text>
          )}
        </Flex>
        {action && (
          <Button
            size="xs"
            priority="link"
            borderless
            icon={action.icon}
            aria-label={action.ariaLabel}
            title={action.tooltip}
            onClick={action.onClick}
          />
        )}
      </Flex>
      {children}
    </Stack>
  );
}
