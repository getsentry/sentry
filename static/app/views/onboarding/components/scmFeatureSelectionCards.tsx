import type {ComponentType} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  IconGraph,
  IconProfiling,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import type {IconGraphProps} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';

import {ScmCardButton} from './scmCardButton';

type FeatureMeta = {
  description: string;
  icon: ComponentType<IconGraphProps>;
  label: string;
};

const FEATURE_META: Record<ProductSolution, FeatureMeta> = {
  [ProductSolution.ERROR_MONITORING]: {
    label: t('Error monitoring'),
    icon: IconWarning,
    description: t('Automatically capture exceptions and stack traces'),
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

type ScmFeatureSelectionCardsProps = {
  availableFeatures: ProductSolution[];
  onToggleFeature: (feature: ProductSolution) => void;
  selectedFeatures: ProductSolution[];
};

export function ScmFeatureSelectionCards({
  availableFeatures,
  selectedFeatures,
  onToggleFeature,
}: ScmFeatureSelectionCardsProps) {
  const selectedCount = selectedFeatures.length;
  const totalCount = availableFeatures.length;

  return (
    <Flex direction="column" gap="md" width="100%">
      <Flex justify="between" align="center">
        <Heading as="h3">{t('What do you want to set up?')}</Heading>
        <Text variant="muted">{t('%s of %s selected', selectedCount, totalCount)}</Text>
      </Flex>
      <Grid columns={2} gap="md">
        {availableFeatures.map(feature => {
          const meta = FEATURE_META[feature];
          const isErrorMonitoring = feature === ProductSolution.ERROR_MONITORING;
          const isSelected = selectedFeatures.includes(feature) || isErrorMonitoring;
          const Icon = meta.icon;

          return (
            <ScmCardButton
              onClick={() => !isErrorMonitoring && onToggleFeature(feature)}
              role="checkbox"
              aria-checked={isSelected}
              disabled={isErrorMonitoring}
              aria-label={meta.label}
              key={feature}
            >
              <Container
                border={isSelected ? 'accent' : 'secondary'}
                padding="lg"
                radius="md"
              >
                <Flex gap="md" align="start">
                  <Flex padding="xs 0 0 0">
                    <Icon size="sm" />
                  </Flex>
                  <Flex direction="column" gap="xs" flex="1">
                    <Flex justify="between" align="center">
                      <Text bold>{meta.label}</Text>
                      <Checkbox
                        readOnly
                        size="xs"
                        tabIndex={-1}
                        role="presentation"
                        checked={isSelected}
                        disabled={isErrorMonitoring}
                      />
                    </Flex>
                    <Text variant="muted" size="sm">
                      {meta.description}
                    </Text>
                  </Flex>
                </Flex>
              </Container>
            </ScmCardButton>
          );
        })}
      </Grid>
    </Flex>
  );
}
