import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureInfoCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
}

// Informational variant of the SCM feature card list. Renders the products
// applicable to the user-selected platform without offering toggles, used for
// platforms whose onboarding is wizard-driven (the wizard CLI handles
// configuration; toggles aren't actionable). Visual treatment is a placeholder;
// designer iterates on this separately.
export function ScmFeatureInfoCards({
  availableFeatures,
  disabledProducts,
  featureMeta,
}: ScmFeatureInfoCardsProps) {
  return (
    <Grid
      gap="2xl"
      columns={{zero: '1fr', xl: '1fr 1fr'}}
      background="primary"
      border="primary"
      radius="xl"
      padding="xl"
    >
      {availableFeatures.map(feature => {
        const meta = featureMeta[feature];
        const Icon = meta.icon;
        const disabledProduct = disabledProducts[feature];
        const isDisabled = !meta.alwaysEnabled && !!disabledProduct;
        return (
          <Tooltip
            key={feature}
            title={disabledProduct?.reason}
            disabled={!isDisabled}
            delay={100}
          >
            {/* Mirrors the toggleable card's inner layout, minus its checkbox. */}
            <Stack height="100%" gap="md">
              <Flex align="center" gap="md">
                <Flex flexShrink={0}>
                  <Icon size="md" variant={isDisabled ? 'muted' : 'secondary'} />
                </Flex>
                <Text bold size="md" variant={isDisabled ? 'muted' : undefined}>
                  {meta.label}
                </Text>
                {meta.alwaysEnabled ? <Tag variant="muted">{t('Always on')}</Tag> : null}
              </Flex>

              <Stack flexGrow={1}>
                <Text
                  variant={isDisabled ? 'muted' : 'muted'}
                  size="md"
                  density="comfortable"
                  textWrap="pretty"
                >
                  {meta.description}
                </Text>
              </Stack>
            </Stack>
          </Tooltip>
        );
      })}
    </Grid>
  );
}
