import type {ComponentType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {ScmCardButton} from './scmCardButton';

interface ScmFeatureCardProps {
  description: string;
  icon: ComponentType<SVGIconProps>;
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
    <Tooltip
      title={disabledReason}
      disabled={!disabledReason}
      delay={500}
      style={{height: '100%'}}
    >
      <ScmCardButton
        onClick={onClick}
        role="checkbox"
        aria-checked={isSelected}
        disabled={disabled}
        style={{width: '100%', height: '100%'}}
      >
        <Container
          border={isSelected ? 'accent' : 'secondary'}
          padding="xl"
          radius="md"
          height="100%"
          style={isSelected ? {marginBottom: 2} : {borderBottomWidth: 3}} // this prevents el height from changing when switching border variant
        >
          <Flex>
            <Grid
              columns="min-content 1fr"
              rows="min-content min-content"
              gap="xs lg"
              align="center"
              areas={`
                    "cell1 cell2"
                    ". cell4"
                  `}
            >
              <Flex area="cell1">
                <Icon size="md" variant={isSelected ? 'accent' : undefined} />
              </Flex>

              <Flex area="cell2">
                <Text bold size="lg">
                  {label}
                </Text>
              </Flex>
              <Flex area="cell4">
                <Text variant="muted">{description}</Text>
              </Flex>
            </Grid>
            <Flex align="start">
              <Checkbox
                readOnly
                size="sm"
                tabIndex={-1}
                role="presentation"
                checked={isSelected}
                disabled={disabled}
              />
            </Flex>
          </Flex>
        </Container>
      </ScmCardButton>
    </Tooltip>
  );
}
