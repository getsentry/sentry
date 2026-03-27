import type {ComponentType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {ScmCardButton} from './scmCardButton';
import {ScmSelectableContainer} from './scmSelectableContainer';

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
        <ScmSelectableContainer
          isSelected={isSelected}
          padding="xl"
          height="100%"
          borderCompensation={3}
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
              <Container area="cell1">
                {containerProps => (
                  <Icon
                    {...containerProps}
                    size="md"
                    variant={isSelected ? 'accent' : undefined}
                  />
                )}
              </Container>

              <Container area="cell2">
                <Text bold size="lg">
                  {label}
                </Text>
              </Container>
              <Container area="cell4">
                <Text variant="muted">{description}</Text>
              </Container>
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
        </ScmSelectableContainer>
      </ScmCardButton>
    </Tooltip>
  );
}
