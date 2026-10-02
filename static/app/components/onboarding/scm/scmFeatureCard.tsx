import {type ComponentType, Fragment, type ReactNode, useId} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {ScmSelectableCardButton} from './scmCardButton';

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

/**
 * A product toggle as its own card: icon, label, description, and a checkbox
 * indicator. Meant to be laid out in a grid alongside its siblings. Selection
 * lives on the card button; the checkbox only mirrors it.
 */
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
        checkbox inside it) so it opens on keyboard focus as well as hover. The
        tooltip replaces aria-describedby on its trigger, so a card with a
        reason describes that instead of its volume. */}
      <Tooltip title={disabledReason} disabled={!disabledReason} delay={500} skipWrapper>
        <ScmSelectableCardButton
          disabled={disabled}
          onClick={onClick}
          role="checkbox"
          aria-checked={isSelected}
          aria-describedby={hasVolume ? volumeDescriptionId : undefined}
          {...ONBOARDING_ENTER}
        >
          <Container height="100%" radius="lg" padding="xl">
            <Stack height="100%" gap="md">
              <Flex align="center" justify="between" gap="md">
                <Flex align="center" gap="md" minWidth={0}>
                  <Flex flexShrink={0}>
                    <Icon size="md" variant="secondary" aria-hidden />
                  </Flex>
                  <Text bold size="md">
                    {label}
                  </Text>
                </Flex>
                {/* Visual only: the card button carries the checkbox role and
                  state, so the checkbox is hidden from the accessibility tree. */}
                <Flex flexShrink={0} pointerEvents="none">
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled}
                    aria-hidden
                    tabIndex={-1}
                    readOnly
                  />
                </Flex>
              </Flex>

              <Stack flexGrow={1}>
                <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
                  {description}
                </Text>
              </Stack>

              {showVolume ? (
                <Stack gap="md" width="100%" paddingTop="md">
                  <Separator orientation="horizontal" border="primary" />
                  <Flex align="center" justify="between" gap="md">
                    <Text variant="muted" size="sm">
                      {t('After 14 days')}
                    </Text>
                    {isVolumeLoading ? (
                      <Placeholder height="18px" width="88px" />
                    ) : (
                      // InfoText would be the house component, but it always
                      // takes tabIndex={0} outside overflow mode, and interactive
                      // content cannot nest inside the card's button. Tooltip
                      // draws the same underline without the focus stop.
                      // eslint-disable-next-line @sentry/scraps/prefer-info-text
                      <Tooltip
                        title={volumeTooltip}
                        delay={100}
                        skipWrapper
                        showUnderline
                      >
                        <Text variant="primary" size="sm" bold>
                          {volume}
                        </Text>
                      </Tooltip>
                    )}
                  </Flex>
                </Stack>
              ) : null}
            </Stack>
          </Container>
        </ScmSelectableCardButton>
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
