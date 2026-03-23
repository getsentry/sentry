import type {ComponentType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {IconGraphProps} from 'sentry/icons/iconGraph';

import {ScmCardButton} from './scmCardButton';

interface ScmFeatureCardProps {
  description: string;
  icon: ComponentType<IconGraphProps>;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: ReactNode;
}

export function ScmFeatureCard({
  icon: Icon,
  label,
  description,
  isSelected,
  disabled,
  disabledReason,
  onClick,
}: ScmFeatureCardProps) {
  return (
    <Tooltip title={disabledReason} disabled={!disabledReason} delay={500}>
      <ScmCardButton
        onClick={onClick}
        role="checkbox"
        aria-checked={isSelected}
        disabled={disabled}
      >
        <Container border={isSelected ? 'accent' : 'secondary'} padding="lg" radius="md">
          <Flex gap="md" align="start">
            <Container padding="xs 0 0 0">
              {containerProps => <Icon size="sm" {...containerProps} />}
            </Container>
            <Flex direction="column" gap="xs" flex="1">
              <Flex justify="between" align="center">
                <Text bold>{label}</Text>
                <Checkbox
                  readOnly
                  size="xs"
                  tabIndex={-1}
                  role="presentation"
                  checked={isSelected}
                  disabled={disabled}
                />
              </Flex>
              <Text variant="muted" size="sm">
                {description}
              </Text>
            </Flex>
          </Flex>
        </Container>
      </ScmCardButton>
    </Tooltip>
  );
}
