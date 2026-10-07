import {motion} from 'framer-motion';

import {Grid} from '@sentry/scraps/layout';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';
import {ONBOARDING_STAGGER_CHILDREN} from 'sentry/views/onboarding/animations';

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
    </MotionGrid>
  );
}

const MotionGrid = motion.create(Grid);
