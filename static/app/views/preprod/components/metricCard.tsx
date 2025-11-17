import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

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
  action?: MetricCardAction;
  labelTooltip?: ReactNode;
  minWidth?: number;
  style?: CSSProperties;
}

export function MetricCard(props: MetricCardProps) {
  const {icon, label, labelTooltip, action, children, minWidth, style} = props;

  return (
    <CardContainer
      background="primary"
      radius="lg"
      padding="xl"
      gap="xs"
      border="primary"
      flex="1"
      $minWidth={minWidth ?? 220}
      style={style}
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
          <Tooltip title={action.tooltip}>
            <IconButton
              type="button"
              aria-label={action.ariaLabel}
              onClick={action.onClick}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        )}
      </Flex>
      {children}
    </CardContainer>
  );
}

const CardContainer = styled(Stack)<{$minWidth: number}>`
  min-width: ${p => p.$minWidth}px;
`;

const IconButton = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space['2xs']};
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.white};
    outline-offset: 2px;
  }
`;
