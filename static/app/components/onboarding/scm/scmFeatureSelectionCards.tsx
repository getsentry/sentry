import {Fragment, useId} from 'react';
import {css} from '@emotion/react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {motion} from 'framer-motion';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {
  ONBOARDING_ENTER,
  ONBOARDING_STAGGER_CHILDREN,
} from 'sentry/views/onboarding/animations';

import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureSelectionCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
  isOnboarding: boolean;
  onToggleFeature: (feature: ProductSolution) => void;
  selectedFeatures: ProductSolution[];
  isVolumeLoading?: boolean;
  /**
   * Names the card group. The heading it points at lives in the panel above,
   * so the group carries no heading of its own.
   */
  labelledBy?: string;
}

export function ScmFeatureSelectionCards({
  availableFeatures,
  selectedFeatures,
  disabledProducts,
  onToggleFeature,
  featureMeta,
  isVolumeLoading,
  isOnboarding,
  labelledBy,
}: ScmFeatureSelectionCardsProps) {
  const groupId = useId();

  return (
    <MotionGrid
      width="100%"
      columns={{
        zero: '1fr',
        md: 'repeat(2, minmax(0, 1fr))',
      }}
      gap="lg"
      role="group"
      aria-labelledby={labelledBy}
      {...ONBOARDING_STAGGER_CHILDREN}
    >
      {availableFeatures.map(feature => {
        const meta = featureMeta[feature];
        const Icon = meta.icon;
        const descriptionId = `${groupId}-${feature}-volume`;
        const hasVolume = isOnboarding && !isVolumeLoading;
        const disabledProduct = disabledProducts[feature];
        const disabledReason = meta.alwaysEnabled
          ? t('Error monitoring is always enabled')
          : disabledProduct?.reason;
        return (
          <Fragment key={feature}>
            <Tooltip
              title={disabledReason}
              disabled={!disabledReason}
              delay={500}
              skipWrapper
            >
              <MotionToggleCard
                variant="checkbox"
                checked={selectedFeatures.includes(feature) || !!meta.alwaysEnabled}
                disabled={!!meta.alwaysEnabled || !!disabledProduct}
                onChange={() => onToggleFeature(feature)}
                aria-describedby={hasVolume ? descriptionId : undefined}
                {...ONBOARDING_ENTER}
              >
                <Stack height="100%" gap="md">
                  <Flex align="center" justify="between" gap="md">
                    <Flex align="center" gap="md" minWidth={0}>
                      <Flex flexShrink={0}>
                        <Icon size="md" variant="secondary" aria-hidden />
                      </Flex>
                      <Text bold size="md">
                        {meta.label}
                      </Text>
                    </Flex>
                    <ToggleCard.Indicator />
                  </Flex>
                  <Stack flexGrow={1}>
                    <Text
                      variant="muted"
                      size="md"
                      density="comfortable"
                      textWrap="pretty"
                    >
                      {meta.description}
                    </Text>
                  </Stack>
                  {isOnboarding && (
                    <Stack gap="md" width="100%" paddingTop="md">
                      <Separator orientation="horizontal" border="primary" />
                      <Flex align="center" justify="between" gap="md">
                        <Text variant="muted" size="sm">
                          {t('After 14 days')}
                        </Text>
                        {isVolumeLoading ? (
                          <Placeholder height="18px" width="88px" />
                        ) : (
                          // Keep the volume tooltip out of the keyboard tab order.
                          // eslint-disable-next-line @sentry/scraps/prefer-info-text
                          <Tooltip
                            title={meta.volumeTooltip}
                            delay={100}
                            skipWrapper
                            showUnderline
                          >
                            <Text
                              css={css`
                                position: relative;
                              `}
                              variant="primary"
                              size="sm"
                              bold
                            >
                              {meta.volume}
                            </Text>
                          </Tooltip>
                        )}
                      </Flex>
                    </Stack>
                  )}
                </Stack>
              </MotionToggleCard>
            </Tooltip>
            {hasVolume && (
              <VisuallyHidden id={descriptionId}>{meta.volumeTooltip}</VisuallyHidden>
            )}
          </Fragment>
        );
      })}
    </MotionGrid>
  );
}

const MotionGrid = motion.create(Grid);

const MotionToggleCard = motion.create(ToggleCard);
