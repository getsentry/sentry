import {type ReactNode, useCallback, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {PLATFORM_PRODUCT_INFO} from 'sentry/data/platformProductInfo.generated';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {type ScmAnalyticsFlow, scmFlowVariantParams} from './scmAnalyticsFlow';
import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmFeatureInfoCards} from './scmFeatureInfoCards';
import {ScmFeatureSelectionCards} from './scmFeatureSelectionCards';
import {
  DEFAULT_SCM_FEATURES,
  FEATURE_DISPLAY_ORDER,
  getPlatformName,
} from './scmPlatformHelpers';
import {useScmFeatureMeta} from './useScmFeatureMeta';
import {useScmResolvedPlatform} from './useScmResolvedPlatform';

const FEATURE_TOGGLED_EVENT = {
  onboarding: 'onboarding.scm_platform_feature_toggled',
  'project-creation': 'project_creation.platform_feature_toggled',
} as const;

interface ScmFeatureSelectionPanelProps {
  analyticsFlow: ScmAnalyticsFlow;
  onFeaturesChange: (features: ProductSolution[] | undefined) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
  // Kept inside the reveal so hosts do not strand a divider when the panel closes.
  trailing?: ReactNode;
}

/**
 * Feature selection for the resolved platform, rendered as a sibling of
 * `ScmPlatformFeaturesCore`. Toggleable cards for platforms whose products are
 * user-configurable, informational cards for wizard-driven platforms, and
 * nothing when a resolved platform has no product info. The resolved platform is the
 * host's explicit selection or, before that commits, the first auto-detected
 * platform — re-derived here from the same (deduped) detection query Core uses.
 * Owns the feature-toggled analytic. In project creation, an unresolved platform
 * keeps the section visible with the select-a-platform prompt; onboarding hides it
 * until resolution.
 */
export function ScmFeatureSelectionPanel({
  analyticsFlow,
  onFeaturesChange,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
  trailing,
}: ScmFeatureSelectionPanelProps) {
  const organization = useOrganization();
  // Trial/billing framing (the "unlimited volume" banner and per-feature volume
  // limits) only makes sense during new-org onboarding, where a fresh trial is
  // always active. In SCM-first project creation the viewer is an existing org
  // on an unknown plan, so we hide that framing rather than show numbers that
  // may not apply.
  const isOnboarding = analyticsFlow === 'onboarding';
  const {meta: featureMeta, isLoading: isFeatureMetaLoading} = useScmFeatureMeta();

  const currentFeatures = useMemo(
    () => selectedFeatures ?? DEFAULT_SCM_FEATURES,
    [selectedFeatures]
  );

  const {currentPlatformKey} = useScmResolvedPlatform({
    selectedPlatform,
    selectedRepository,
  });

  // Wizard-driven platforms render an informational variant since the wizard CLI
  // owns product configuration and toggles aren't actionable.
  const featureMode = useMemo<'toggleable' | 'informational' | 'none'>(() => {
    if (!currentPlatformKey) {
      return 'none';
    }
    if (currentPlatformKey in platformProductAvailability) {
      return 'toggleable';
    }
    if (currentPlatformKey in PLATFORM_PRODUCT_INFO) {
      return 'informational';
    }
    return 'none';
  }, [currentPlatformKey]);

  const availableFeatures = useMemo(() => {
    if (!currentPlatformKey || featureMode === 'none') {
      return [];
    }
    const sourceProducts =
      featureMode === 'toggleable'
        ? platformProductAvailability[currentPlatformKey]
        : PLATFORM_PRODUCT_INFO[currentPlatformKey];
    const features = new Set<ProductSolution>([
      ProductSolution.ERROR_MONITORING,
      ...(sourceProducts ?? []),
    ]);
    return FEATURE_DISPLAY_ORDER.filter(f => features.has(f));
  }, [currentPlatformKey, featureMode]);

  const disabledProducts = useMemo(
    () => getDisabledProducts(organization),
    [organization]
  );

  const handleToggleFeature = useCallback(
    (feature: ProductSolution) => {
      if (disabledProducts[feature]) {
        disabledProducts[feature]?.onClick?.();
        return;
      }

      const wasEnabled = currentFeatures.includes(feature);
      const newFeatures = new Set(
        wasEnabled
          ? currentFeatures.filter(f => f !== feature)
          : [...currentFeatures, feature]
      );

      // Profiling requires tracing — mirror the constraint from ProductSelection
      if (availableFeatures.includes(ProductSolution.PROFILING)) {
        if (
          feature === ProductSolution.PROFILING &&
          newFeatures.has(ProductSolution.PROFILING)
        ) {
          newFeatures.add(ProductSolution.PERFORMANCE_MONITORING);
        } else if (
          feature === ProductSolution.PERFORMANCE_MONITORING &&
          !newFeatures.has(ProductSolution.PERFORMANCE_MONITORING)
        ) {
          newFeatures.delete(ProductSolution.PROFILING);
        }
      }

      onFeaturesChange(Array.from(newFeatures));

      trackAnalytics(FEATURE_TOGGLED_EVENT[analyticsFlow], {
        organization,
        feature,
        enabled: !wasEnabled,
        platform: currentPlatformKey ?? '',
        ...scmFlowVariantParams(analyticsFlow),
      });
    },
    [
      currentFeatures,
      onFeaturesChange,
      disabledProducts,
      availableFeatures,
      organization,
      currentPlatformKey,
      analyticsFlow,
    ]
  );

  const hasFeatureCards = featureMode !== 'none';
  const currentPlatformName = getPlatformName(currentPlatformKey);
  const isInformational = featureMode === 'informational';

  // Onboarding frames the list as a question; project creation renders its own
  // "Products" heading above instead. Both list variants share this header so
  // the section reads the same whether or not the products are selectable.
  const sectionHeader = isOnboarding ? (
    <Stack gap="xs">
      <Heading as="h3" size="lg">
        {isInformational && currentPlatformName
          ? tct('What you can track with [platformName]', {
              platformName: (
                <Text as="span" bold variant="accent">
                  {currentPlatformName}
                </Text>
              ),
            })
          : t('What do you want to track?')}
      </Heading>
      {isInformational ? (
        <Text size="lg" variant="muted" density="comfortable">
          {t('Your setup wizard will ask which of these to turn on in the next step.')}
        </Text>
      ) : null}
      {isInformational ? null : (
        <Text size="lg" variant="muted" density="comfortable">
          {tct(
            'You’ve got [promo:unlimited volume for 14 days]. After that, free plan volumes apply. No card required.',
            {
              promo: (
                <Text as="span" variant="promotion">
                  {null}
                </Text>
              ),
            }
          )}
        </Text>
      )}
    </Stack>
  ) : null;

  let featureCards: ReactNode = null;
  if (featureMode === 'toggleable') {
    featureCards = (
      <ScmFeatureSelectionCards
        availableFeatures={availableFeatures}
        selectedFeatures={currentFeatures}
        disabledProducts={disabledProducts}
        onToggleFeature={handleToggleFeature}
        featureMeta={featureMeta}
        isVolumeLoading={isFeatureMetaLoading}
        isOnboarding={isOnboarding}
      />
    );
  } else if (featureMode === 'informational') {
    featureCards = (
      <ScmFeatureInfoCards
        availableFeatures={availableFeatures}
        disabledProducts={disabledProducts}
        featureMeta={featureMeta}
      />
    );
  }

  // Project creation keeps the section open for the select-a-platform prompt.
  const showSection = hasFeatureCards || (!isOnboarding && !currentPlatformKey);

  return (
    <ScmCollapsibleReveal open={showSection}>
      <Stack gap="0" width="100%">
        <Stack width="100%">
          {/* Padding, unlike a flex gap, is clipped during the card reveal. */}
          <Stack gap="0" paddingTop={isOnboarding ? 'xs' : undefined}>
            {isOnboarding ? null : (
              <Flex justify="between" align="center" gap="md">
                <Heading as="h4">{t('Products')}</Heading>
                {currentPlatformKey ? null : (
                  <Tag variant="muted" icon={<IconInfo />} style={{minWidth: 0}}>
                    <Text ellipsis variant="inherit">
                      {t('Select a platform to configure products')}
                    </Text>
                  </Tag>
                )}
              </Flex>
            )}

            <ScmCollapsibleReveal open={hasFeatureCards}>
              <Container paddingTop={isOnboarding ? '2xl' : 'lg'}>
                <Stack gap="lg" width="100%">
                  {sectionHeader}
                  {featureCards}
                </Stack>
              </Container>
            </ScmCollapsibleReveal>
          </Stack>
        </Stack>
        {trailing}
      </Stack>
    </ScmCollapsibleReveal>
  );
}
