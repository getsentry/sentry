import type {ComponentType} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
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
  volume: string;
  volumeTooltip: string;
  alwaysEnabled?: boolean;
};

const FEATURE_META: Record<ProductSolution, FeatureMeta> = {
  [ProductSolution.ERROR_MONITORING]: {
    label: t('Error monitoring'),
    icon: IconWarning,
    description: t('Automatically capture exceptions and stack traces'),
    alwaysEnabled: true,
    volume: t('5,000 errors / mo'),
    volumeTooltip: t(
      'Free plan includes 5,000 errors / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    label: t('Tracing'),
    icon: IconSpan,
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end'
    ),
    volume: t('5M spans / mo'),
    volumeTooltip: t(
      'Free plan includes 5M spans / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    label: t('Session replay'),
    icon: IconTimer,
    description: t('Watch real user sessions to see what went wrong'),
    volume: t('50 replays / mo'),
    volumeTooltip: t(
      'Free plan includes 50 replays / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.LOGS]: {
    label: t('Logging'),
    icon: IconTerminal,
    description: t('See logs in context with errors and performance issues'),
    volume: t('5 GB logs / mo'),
    volumeTooltip: t(
      'Free plan includes 5 GB logs / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PROFILING]: {
    label: t('Profiling'),
    icon: IconProfiling,
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues'
    ),
    volume: t('Usage-based'),
    volumeTooltip: t('Upgrade to Team or Business to send more.'),
  },
  [ProductSolution.METRICS]: {
    label: t('Application Metrics'),
    icon: IconGraph,
    description: t(
      'Track application performance and usage over time with custom metrics'
    ),
    volume: t('5 GB / mo'),
    volumeTooltip: t('Free plan includes 5 GB metrics / month'),
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
              volume={meta.volume}
              volumeTooltip={meta.volumeTooltip}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
