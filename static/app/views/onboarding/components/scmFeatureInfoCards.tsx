import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {Placeholder} from 'sentry/components/placeholder';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t} from 'sentry/locale';

import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureInfoCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
  isVolumeLoading?: boolean;
}

// Informational variant of the SCM feature card list. Renders the products
// applicable to the user-selected platform without offering toggles, used for
// platforms whose onboarding is wizard-driven (the wizard CLI handles
// configuration; toggles aren't actionable). Visual treatment is a placeholder;
// designer iterates on this separately.
export function ScmFeatureInfoCards({
  availableFeatures,
  featureMeta,
  isVolumeLoading,
}: ScmFeatureInfoCardsProps) {
  return (
    <Stack gap="xl" width="100%" justify="center">
      <Flex justify="between" align="center">
        <Heading as="h3" size="xl">
          {t('Features available for this platform')}
        </Heading>
      </Flex>
      <Grid gap="md" columns="1fr 1fr">
        {availableFeatures.map(feature => {
          const meta = featureMeta[feature];
          return (
            <Container key={feature} padding="lg" border="primary" radius="md">
              <Flex justify="between" align="start" gap="md">
                <Stack gap="xs">
                  <Text bold size="md">
                    {meta.label}
                  </Text>
                  <Text variant="secondary">{meta.description}</Text>
                </Stack>
                <Flex align="start" gap="sm">
                  {isVolumeLoading ? (
                    <Placeholder height="22px" width="100px" />
                  ) : (
                    <Tooltip title={meta.volumeTooltip} delay={100}>
                      <Tag variant="muted" icon={<IconInfo size="sm" />}>
                        {meta.volume}
                      </Tag>
                    </Tooltip>
                  )}
                </Flex>
              </Flex>
            </Container>
          );
        })}
      </Grid>
    </Stack>
  );
}
