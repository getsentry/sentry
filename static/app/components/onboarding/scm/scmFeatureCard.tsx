import type {ComponentType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {ScmSelectableCardButton} from './scmCardButton';

interface ScmFeatureRowProps {
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
export function ScmFeatureRow({
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
}: ScmFeatureRowProps) {
  return (
    <Tooltip title={disabledReason} disabled={!disabledReason} delay={500}>
      <ScmSelectableCardButton
        disabled={disabled}
        onClick={onClick}
        role="checkbox"
        aria-checked={isSelected}
        {...ONBOARDING_ENTER}
      >
        <Container height="100%" radius="lg" padding="xl">
          <Stack height="100%" gap="md">
            <Flex align="center" justify="between" gap="md">
              <Flex align="center" gap="md" minWidth={0}>
                <Flex flexShrink={0}>
                  <Icon size="md" variant="secondary" />
                </Flex>
                <Text bold size="md">
                  {label}
                </Text>
              </Flex>
              {/* Presentational only: let the card own hover and cursor. */}
              <Flex flexShrink={0} pointerEvents="none">
                <Checkbox
                  checked={isSelected}
                  disabled={disabled}
                  role="presentation"
                  tabIndex={-1}
                  readOnly
                />
              </Flex>
            </Flex>

            {/* Grows so the volume row sits on the card's floor, level with
                its siblings however long their descriptions run. */}
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
                    <InfoText
                      title={volumeTooltip}
                      delay={100}
                      variant="primary"
                      size="sm"
                      bold
                    >
                      {volume}
                    </InfoText>
                  )}
                </Flex>
              </Stack>
            ) : null}
          </Stack>
        </Container>
      </ScmSelectableCardButton>
    </Tooltip>
  );
}
