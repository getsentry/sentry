import type {ComponentType} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Grid} from '@sentry/scraps/layout';
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
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

import {getAvailableFeaturesForPlatform} from './platformDetection';

type FeatureMeta = {
  description: string;
  icon: ComponentType<SVGIconProps>;
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

const ALL_FEATURES = Object.values(ProductSolution);

type FeatureSelectionCardsProps = {
  onToggleFeature: (feature: ProductSolution) => void;
  selectedFeatures: ProductSolution[];
  platform?: PlatformKey;
};

export function FeatureSelectionCards({
  platform,
  selectedFeatures,
  onToggleFeature,
}: FeatureSelectionCardsProps) {
  const availableFeatures = platform
    ? [ProductSolution.ERROR_MONITORING, ...getAvailableFeaturesForPlatform(platform)]
    : ALL_FEATURES;

  // Deduplicate (ERROR_MONITORING might already be in the list)
  const uniqueFeatures = [...new Set(availableFeatures)];

  const selectedCount = selectedFeatures.length;
  const totalCount = uniqueFeatures.length;

  return (
    <Flex direction="column" gap="md" width="100%">
      <Flex justify="space-between" align="center">
        <Heading as="h3">{t('What do you want to set up?')}</Heading>
        <Text variant="muted">{t('%s of %s selected', selectedCount, totalCount)}</Text>
      </Flex>
      <Grid columns={2} gap="md">
        {uniqueFeatures.map(feature => {
          const meta = FEATURE_META[feature];
          const isErrorMonitoring = feature === ProductSolution.ERROR_MONITORING;
          const isSelected = selectedFeatures.includes(feature) || isErrorMonitoring;
          const Icon = meta.icon;

          return (
            <FeatureCard
              key={feature}
              selected={isSelected}
              disabled={isErrorMonitoring}
              onClick={() => !isErrorMonitoring && onToggleFeature(feature)}
              role="checkbox"
              aria-checked={isSelected}
              aria-disabled={isErrorMonitoring}
              aria-label={meta.label}
            >
              <Flex gap="md" align="flex-start">
                <Flex padding="xs 0 0 0">
                  <Icon size="sm" />
                </Flex>
                <Flex direction="column" gap="xs" flex="1">
                  <Flex justify="space-between" align="center">
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
            </FeatureCard>
          );
        })}
      </Grid>
    </Flex>
  );
}

const FeatureCard = styled('button')<{disabled?: boolean; selected?: boolean}>`
  text-align: left;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid
    ${p =>
      p.selected
        ? p.theme.tokens.border.accent.vibrant
        : p.theme.tokens.border.secondary};
  border-bottom-width: ${p => (p.selected ? '1px' : '3px')};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  opacity: ${p => (p.disabled ? 0.75 : 1)};
  transition:
    border-color 0.1s ease,
    background-color 0.1s ease;

  &:hover {
    ${p =>
      !p.disabled &&
      `
      background: ${p.theme.tokens.background.secondary};
    `}
  }

  &:focus-visible {
    ${p => p.theme.focusRing()};
  }
`;
