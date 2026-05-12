import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';

import type {FeatureMeta} from './useScmFeatureMeta';

interface ScmFeatureInfoCardsProps {
  availableFeatures: ProductSolution[];
  disabledProducts: DisabledProducts;
  featureMeta: Record<ProductSolution, FeatureMeta>;
  isVolumeLoading?: boolean;
  platformName?: string;
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
  platformName,
  isVolumeLoading,
}: ScmFeatureInfoCardsProps) {
  return (
    <Stack gap="xl" width="100%" justify="center">
      <Stack gap="md">
        {platformName ? (
          <Heading as="h3" size="xl">
            {tct('Available with [platformName]', {
              platformName: (
                <Text as="span" bold variant="accent">
                  {platformName}
                </Text>
              ),
            })}
          </Heading>
        ) : null}
        <Text size="lg" variant="secondary" density="comfortable">
          {t('In the next step, run our setup wizard to choose what to instrument')}
        </Text>
      </Stack>
      <Grid
        gap="2xl"
        columns={{xs: '1fr', sm: '1fr 1fr'}}
        border="secondary"
        radius="lg"
        padding="2xl"
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
              <Grid
                columns="min-content 1fr"
                rows="min-content min-content"
                gap={{xs: 'xs md', sm: 'xs lg'}}
                align="center"
                areas={`
                    "icon label"
                    ". description"
                  `}
              >
                <Container area="icon">
                  {containerProps => (
                    <Icon
                      {...containerProps}
                      size="md"
                      variant={isDisabled ? 'muted' : undefined}
                    />
                  )}
                </Container>
                <Flex area="label" gap="sm" align="center">
                  <Text bold size="md" variant={isDisabled ? 'muted' : undefined}>
                    {meta.label}
                  </Text>
                  {meta.alwaysEnabled ? (
                    <Tag variant="muted">{t('Always on')}</Tag>
                  ) : null}
                </Flex>
                <Stack gap="md" area="description">
                  <Text
                    variant={isDisabled ? 'muted' : 'secondary'}
                    density="comfortable"
                  >
                    {meta.description}
                  </Text>
                  <Container>
                    {isVolumeLoading ? (
                      <Placeholder height="20px" width="100px" />
                    ) : (
                      <Tooltip
                        title={meta.volumeTooltip}
                        delay={100}
                        disabled={isDisabled}
                      >
                        <Text
                          variant="muted"
                          underline="dotted"
                          size="sm"
                          density="comfortable"
                        >
                          {meta.volume}
                        </Text>
                      </Tooltip>
                    )}
                  </Container>
                </Stack>
              </Grid>
            </Tooltip>
          );
        })}
      </Grid>
    </Stack>
  );
}
