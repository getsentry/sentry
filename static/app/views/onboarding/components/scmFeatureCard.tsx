import type {ComponentType, ReactNode} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import {ScmCardButton} from './scmCardButton';
import {ScmSelectableContainer} from './scmSelectableContainer';

interface ScmFeatureCardProps {
  description: string;
  icon: ComponentType<SVGIconProps>;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  alwaysEnabled?: boolean;
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
  alwaysEnabled,
}: ScmFeatureCardProps) {
  return (
    <Tooltip title={disabledReason} disabled={!disabledReason} style={{height: '100%'}}>
      <ScmCardButton
        onClick={onClick}
        role="checkbox"
        aria-checked={isSelected}
        disabled={disabled}
        style={{width: '100%', height: '100%'}}
      >
        <ScmSelectableContainer
          isSelected={isSelected}
          padding={{xs: 'md', md: 'lg'}}
          height="100%"
          borderCompensation={3}
        >
          <Flex>
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
                <Text bold size="lg">
                  {label}
                </Text>
              </Container>
              <Container area="description">
                <Text variant="muted">{description}</Text>
              </Container>
            </Grid>
            <Flex align="start" flexShrink={0}>
              {alwaysEnabled ? (
                <Badge variant="info">{t('Always on')}</Badge>
              ) : (
                <Checkbox
                  readOnly
                  size="sm"
                  tabIndex={-1}
                  role="presentation"
                  checked={isSelected}
                  disabled={disabled}
                />
              )}
            </Flex>
          </Flex>
        </ScmSelectableContainer>
      </ScmCardButton>
    </Tooltip>
  );
}
