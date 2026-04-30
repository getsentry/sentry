import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

import {ScmFeatureCard} from './scmFeatureCard';
import {useScmFeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureSelectionCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  onToggleFeature: (feature: ProductSolution) => void;
  selectedFeatures: ProductSolution[];
}

export function ScmFeatureSelectionCards({
  availableFeatures,
  selectedFeatures,
  disabledProducts,
  onToggleFeature,
}: ScmFeatureSelectionCardsProps) {
  const {meta: featureMeta, isLoading: isVolumeLoading} = useScmFeatureMeta();
  return (
    <Stack gap="xl" width="100%" justify="center">
      <Flex justify="between" align="center">
        <Heading as="h3" size="xl">
          {t('What do you want to instrument?')}
        </Heading>
        <Text size="sm" variant="secondary">
          {t('Choose one or more')}
        </Text>
      </Flex>
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
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
