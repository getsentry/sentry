import {type ComponentType, Fragment, type ReactNode, useId} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
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
  isVolumeLoading?: boolean;
  showVolume?: boolean;
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
  isVolumeLoading,
  showVolume = true,
}: ScmFeatureCardProps) {
  const volumeDescriptionId = useId();
  const hasVolume = showVolume && !isVolumeLoading;

  return (
    <Fragment>
      {/* The reason a card is disabled hangs off the card itself (not the
        switch inside it) so it opens on keyboard focus as well as hover. The
        tooltip replaces aria-describedby on its trigger, so a card with a
        reason describes that instead of its volume. */}
      <Tooltip title={disabledReason} disabled={!disabledReason} delay={500} skipWrapper>
        <ScmCardButton
          disabled={disabled}
          onClick={onClick}
          role="checkbox"
          aria-checked={isSelected}
          aria-describedby={hasVolume ? volumeDescriptionId : undefined}
          style={{width: '100%', height: '100%'}}
        >
          <ScmSelectableContainer
            isSelected={isSelected}
            padding="lg"
            height="100%"
            borderCompensation={3}
          >
            <Flex align="start">
              <Grid
                columns="min-content 1fr min-content"
                rows="min-content min-content"
                gap="xs lg"
                align="center"
                width="100%"
                areas={`
                    "icon label toggle"
                    ". description ."
                  `}
              >
                <Container area="icon">
                  {containerProps => (
                    <Icon
                      {...containerProps}
                      size="md"
                      variant={isSelected ? 'accent' : undefined}
                      aria-hidden
                    />
                  )}
                </Container>

                <Container area="label">
                  <Text bold size="md">
                    {label}
                  </Text>
                </Container>

                <Flex area="toggle" align="start" gap="sm">
                  {showVolume &&
                    (isVolumeLoading ? (
                      <Placeholder height="22px" width="100px" />
                    ) : (
                      <Tooltip title={volumeTooltip} delay={100}>
                        <Tag variant="muted" icon={<IconInfo size="sm" aria-hidden />}>
                          {volume}
                        </Tag>
                      </Tooltip>
                    ))}
                  {/* Visual only: the card button carries the checkbox role and
                  state, so the switch is hidden from the accessibility tree. */}
                  <Switch
                    checked={isSelected}
                    disabled={disabled}
                    aria-hidden
                    tabIndex={-1}
                    readOnly
                  />
                </Flex>

                <Container area="description" column="2 / -1">
                  <Text variant="secondary">{description}</Text>
                </Container>
              </Grid>
            </Flex>
          </ScmSelectableContainer>
        </ScmCardButton>
      </Tooltip>
      {/* The volume tooltip sits inside the card button, so it can never be
        a focus stop of its own. Its text describes the card instead. It sits
        outside the button: a button's name comes from its content, so inside
        it the text would join the name and be announced twice. */}
      {hasVolume ? (
        <VisuallyHidden id={volumeDescriptionId}>{volumeTooltip}</VisuallyHidden>
      ) : null}
    </Fragment>
  );
}
