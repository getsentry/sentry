import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

import {ScmFeatureCard} from './scmFeatureCard';
import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureSelectionCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
  isOnboarding: boolean;
  onToggleFeature: (feature: ProductSolution) => void;
  selectedFeatures: ProductSolution[];
  isVolumeLoading?: boolean;
}

export function ScmFeatureSelectionCards({
  availableFeatures,
  selectedFeatures,
  disabledProducts,
  onToggleFeature,
  featureMeta,
  isVolumeLoading,
  isOnboarding,
}: ScmFeatureSelectionCardsProps) {
  return (
    <Stack gap="lg" width="100%" justify="center">
      {isOnboarding ? (
        <Flex justify="between" align="center" gap="md">
          <Heading as="h4" ellipsis>
            {t('What do you want to instrument?')}
          </Heading>
          {availableFeatures.length > 1 ? (
            <Container>
              <Text size="sm" variant="secondary" wrap="nowrap">
                {t('Choose one or more')}
              </Text>
            </Container>
          ) : null}
        </Flex>
      ) : null}

      <Stack gap="md">
        {availableFeatures.map(feature => {
          const meta = featureMeta[feature];
          const disabledProduct = disabledProducts[feature];
          const disabledReason = meta.alwaysEnabled
            ? t('Error monitoring is always enabled')
            : disabledProduct?.reason;
          return (
            <ScmFeatureCard
              key={feature}
              icon={meta.icon}
              label={meta.label}
              description={meta.description}
              isSelected={selectedFeatures.includes(feature) || !!meta.alwaysEnabled}
              disabled={!!meta.alwaysEnabled || !!disabledProduct}
              disabledReason={disabledReason}
              onClick={() => onToggleFeature(feature)}
              volume={meta.volume}
              volumeTooltip={meta.volumeTooltip}
              isVolumeLoading={isVolumeLoading}
              showVolume={isOnboarding}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
