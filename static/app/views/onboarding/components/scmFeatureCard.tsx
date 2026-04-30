import type {ComponentType, ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo} from 'sentry/icons/iconInfo';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {ScmCardButton} from './scmCardButton';
import {ScmSelectableContainer} from './scmSelectableContainer';

interface ScmFeatureCardProps {
  description: string;
  icon: ComponentType<SVGIconProps>;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  volume: string;
  volumeTooltip: string;
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
  volume,
  volumeTooltip,
}: ScmFeatureCardProps) {
  return (
    <ScmCardButton
      disabled={disabled}
      onClick={onClick}
      role="checkbox"
      aria-checked={isSelected}
      style={{width: '100%', height: '100%'}}
    >
      <ScmSelectableContainer
        isSelected={isSelected}
        padding={{xs: 'md', md: 'lg'}}
        height="100%"
        borderCompensation={3}
      >
        <Flex align="start">
          <Grid
            columns="min-content 1fr"
            rows="min-content min-content"
            gap={{xs: 'xs md', md: 'xs lg'}}
            align="center"
            width="100%"
            areas={`
                    "icon label"
                    ". description"
                  `}
          >
            <Container area="icon">
              {containerProps => (
                <Icon
                  {...containerProps}
                  size="md"
                  variant={isSelected ? 'accent' : undefined}
                />
              )}
            </Container>

            <Container area="label">
              <Text bold size="md">
                {label}
              </Text>
            </Container>
            <Container area="description">
              <Text variant="secondary">{description}</Text>
            </Container>
          </Grid>
          <Flex align="start" gap="sm">
            <Tooltip title={volumeTooltip} delay={100}>
              <Tag variant="muted" icon={<IconInfo size="sm" />}>
                {volume}
              </Tag>
            </Tooltip>
            <Tooltip title={disabledReason} disabled={!disabledReason} delay={500}>
              <Switch
                checked={isSelected}
                disabled={disabled}
                role="presentation"
                tabIndex={-1}
                readOnly
                size="sm"
              />
            </Tooltip>
          </Flex>
        </Flex>
      </ScmSelectableContainer>
    </ScmCardButton>
  );
}
