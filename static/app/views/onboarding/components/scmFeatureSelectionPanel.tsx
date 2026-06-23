import {Fragment, type ReactNode, useCallback, useMemo} from 'react';
import {motion} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {PLATFORM_PRODUCT_INFO} from 'sentry/data/platformProductInfo.generated';
import {IconBusiness, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
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
  'project-creation': 'project_creation.scm_platform_feature_toggled',
} as const;

interface ScmFeatureSelectionPanelProps {
  analyticsFlow: ScmAnalyticsFlow;
  onFeaturesChange: (features: ProductSolution[] | undefined) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
  // Optional element rendered as a sibling after the panel content (e.g. a
  // divider from the host). Dropped together with the panel when there is
  // nothing to show, so the host never strands an orphaned divider.
  trailing?: ReactNode;
}

/**
 * Feature selection for the resolved platform, rendered as a sibling of
 * `ScmPlatformFeaturesCore`. Toggleable cards for platforms whose products are
 * user-configurable, informational cards for wizard-driven platforms, and
 * nothing when the platform has no product info. The resolved platform is the
 * host's explicit selection or, before that commits, the first auto-detected
 * platform — re-derived here from the same (deduped) detection query Core uses.
 * Owns the feature-toggled analytic; renders nothing for an unresolved platform.
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
  const currentPlatformName = getPlatformName(currentPlatformKey);

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

  // Hide the whole section when a resolved platform has no configurable
  // products. Before a platform is chosen (no resolved key), keep it visible in
  // project creation for the select-a-platform prompt; onboarding hides both.
  if (featureMode === 'none' && (isOnboarding || !!currentPlatformKey)) {
    return null;
  }

  return (
    <Fragment>
      <MotionStack layout="position" width="100%">
        <Stack
          gap={isOnboarding ? '2xl' : 'lg'}
          paddingTop={isOnboarding ? 'xs' : undefined}
        >
          {isOnboarding ? (
            <Flex
              padding="lg"
              background="secondary"
              border="secondary"
              radius="md"
              gap="lg"
            >
              <IconBusiness size="lg" variant="accent" />
              <Text size="md" density="comfortable">
                {tct(
                  'You’ve got [bold:unlimited volume for 14 days] to try out everything. After that, free plan volumes apply ⋅ No credit card required',
                  {
                    bold: (
                      <Text as="span" bold variant="accent">
                        {null}
                      </Text>
                    ),
                  }
                )}
              </Text>
            </Flex>
          ) : null}

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

          {featureMode === 'toggleable' ? (
            <ScmFeatureSelectionCards
              availableFeatures={availableFeatures}
              selectedFeatures={currentFeatures}
              disabledProducts={disabledProducts}
              onToggleFeature={handleToggleFeature}
              featureMeta={featureMeta}
              isVolumeLoading={isFeatureMetaLoading}
              isOnboarding={isOnboarding}
            />
          ) : featureMode === 'informational' ? (
            <ScmFeatureInfoCards
              availableFeatures={availableFeatures}
              disabledProducts={disabledProducts}
              featureMeta={featureMeta}
              platformName={currentPlatformName}
              isVolumeLoading={isFeatureMetaLoading}
              isOnboarding={isOnboarding}
            />
          ) : null}
        </Stack>
      </MotionStack>
      {trailing}
    </Fragment>
  );
}

const MotionStack = motion.create(Stack);
