import type {ComponentType} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {
  IconGraph,
  IconProfiling,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import {ScmFeatureCard} from './scmFeatureCard';

type FeatureMeta = {
  description: string;
  icon: ComponentType<SVGIconProps>;
  label: string;
  alwaysEnabled?: boolean;
};

const FEATURE_META: Record<ProductSolution, FeatureMeta> = {
  [ProductSolution.ERROR_MONITORING]: {
    label: t('Error monitoring'),
    icon: IconWarning,
    description: t('Automatically capture exceptions and stack traces'),
    alwaysEnabled: true,
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    label: t('Tracing'),
    icon: IconSpan,
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end'
    ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    label: t('Session replay'),
    icon: IconTimer,
    description: t('Watch real user sessions to see what went wrong'),
  },
  [ProductSolution.LOGS]: {
    label: t('Logging'),
    icon: IconTerminal,
    description: t('See logs in context with errors and performance issues'),
  },
  [ProductSolution.PROFILING]: {
    label: t('Profiling'),
    icon: IconProfiling,
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues'
    ),
  },
  [ProductSolution.METRICS]: {
    label: t('Metrics'),
    icon: IconGraph,
    description: t(
      'Track application performance and usage over time with custom metrics'
    ),
  },
};

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
  const selectedCount = availableFeatures.filter(
    f => selectedFeatures.includes(f) || FEATURE_META[f].alwaysEnabled
  ).length;
  const totalCount = availableFeatures.length;

  return (
    <Flex direction="column" gap="md" width="100%">
      <Flex justify="between" align="center">
        <Heading as="h3">{t('What do you want to set up?')}</Heading>
        <Text variant="muted">{t('%s of %s selected', selectedCount, totalCount)}</Text>
      </Flex>
      <Grid columns={2} gap="lg">
        {availableFeatures.map(feature => {
          const meta = FEATURE_META[feature];
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
            />
          );
        })}
      </Grid>
    </Flex>
  );
}
