import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureInfoCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
  isOnboarding: boolean;
  isVolumeLoading?: boolean;
}

// Informational variant of the SCM feature card list. Renders the products
// applicable to the user-selected platform without offering toggles, used for
// platforms whose onboarding is wizard-driven (the wizard CLI handles
// configuration; toggles aren't actionable). Onboarding shows each product's
// volume the same way the toggleable cards do.
export function ScmFeatureInfoCards({
  availableFeatures,
  disabledProducts,
  featureMeta,
  isOnboarding,
  isVolumeLoading,
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
            <Stack height="100%" gap="md">
              <Flex align="center" gap="md">
                <Flex flexShrink={0}>
                  <Icon
                    size="md"
                    variant={isDisabled ? 'muted' : 'secondary'}
                    aria-hidden
                  />
                </Flex>
                <Text bold size="md" variant={isDisabled ? 'muted' : undefined}>
                  {meta.label}
                </Text>
                {meta.alwaysEnabled ? <Tag variant="muted">{t('Always on')}</Tag> : null}
              </Flex>

              <Stack flexGrow={1}>
                <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
                  {meta.description}
                </Text>
              </Stack>

              {isOnboarding ? (
                <Stack gap="md" width="100%" paddingTop="md">
                  <Separator orientation="horizontal" border="primary" />
                  <Flex align="center" justify="between" gap="md">
                    <Text variant="muted" size="sm">
                      {t('After 14 days')}
                    </Text>
                    {isVolumeLoading ? (
                      <Placeholder height="18px" width="88px" />
                    ) : (
                      <InfoText
                        title={isDisabled ? null : meta.volumeTooltip}
                        delay={100}
                        variant="primary"
                        size="sm"
                        bold
                      >
                        {meta.volume}
                      </InfoText>
                    )}
                  </Flex>
                </Stack>
              ) : null}
            </Stack>
          </Tooltip>
        );
      })}
    </Grid>
  );
}
