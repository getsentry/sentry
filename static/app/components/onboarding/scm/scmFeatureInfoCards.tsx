import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
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
// configuration; toggles aren't actionable). Visual treatment is a placeholder;
// designer iterates on this separately.
export function ScmFeatureInfoCards({
  availableFeatures,
  disabledProducts,
  featureMeta,
  isVolumeLoading,
  isOnboarding,
}: ScmFeatureInfoCardsProps) {
  return (
    <Stack gap="xl" width="100%" justify="center">
      {isOnboarding ? (
        <Text size="md" variant="secondary" density="comfortable">
          {t('The setup wizard in the next step lets you choose what to track.')}
        </Text>
      ) : null}

      <Grid
        gap="2xl"
        columns={{zero: '1fr', xl: '1fr 1fr'}}
        background="primary"
        border="primary"
        radius="xl"
        padding="xl"
        style={{borderBottomWidth: 2}}
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
                gap="xs lg"
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
                  {isOnboarding ? (
                    <Container>
                      {isVolumeLoading ? (
                        <Placeholder height="20px" width="100px" />
                      ) : (
                        <InfoText
                          title={isDisabled ? null : meta.volumeTooltip}
                          delay={100}
                          variant="muted"
                          size="sm"
                          density="comfortable"
                        >
                          {meta.volume}
                        </InfoText>
                      )}
                    </Container>
                  ) : null}
                </Stack>
              </Grid>
            </Tooltip>
          );
        })}
      </Grid>
    </Stack>
  );
}
