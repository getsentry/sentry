import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {closeModal, openConsoleModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {PLATFORM_PRODUCT_INFO} from 'sentry/data/platformProductInfo.generated';
import {IconBroadcast, IconBusiness, IconGeneric} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmFeatureInfoCards} from './scmFeatureInfoCards';
import {ScmFeatureSelectionCards} from './scmFeatureSelectionCards';
import {ScmPlatformCard} from './scmPlatformCard';
import {
  FEATURE_DISPLAY_ORDER,
  getPlatformInfo,
  getPlatformName,
  platformOptions,
  type ResolvedPlatform,
  shouldSuggestFramework,
  toSelectedSdk,
} from './scmPlatformHelpers';
import {ScmSearchControl} from './scmSearchControl';
import {ScmVirtualizedMenuList} from './scmVirtualizedMenuList';
import {useScmFeatureMeta} from './useScmFeatureMeta';
import {useScmPlatformDetection} from './useScmPlatformDetection';

const STEP_VIEWED_EVENT = {
  onboarding: 'onboarding.scm_platform_features_step_viewed',
  'project-creation': 'project_creation.scm_platform_features_step_viewed',
} as const;
const PLATFORM_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_platform_selected',
  'project-creation': 'project_creation.scm_platform_selected',
} as const;
const FEATURE_TOGGLED_EVENT = {
  onboarding: 'onboarding.scm_platform_feature_toggled',
  'project-creation': 'project_creation.scm_platform_feature_toggled',
} as const;
const CHANGE_PLATFORM_CLICKED_EVENT = {
  onboarding: 'onboarding.scm_platform_change_platform_clicked',
  'project-creation': 'project_creation.scm_platform_change_platform_clicked',
} as const;
const SKIP_DETECTION_CLICKED_EVENT = {
  onboarding: 'onboarding.scm_skip_detection_clicked',
  'project-creation': 'project_creation.scm_skip_detection_clicked',
} as const;

interface ScmPlatformFeaturesCoreProps {
  analyticsFlow: ScmAnalyticsFlow;
  onClearProjectDetailsForm: () => void;
  onFeaturesChange: (features: ProductSolution[] | undefined) => void;
  onPlatformChange: (platform: OnboardingSelectedSDK | undefined) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

/**
 * Core platform-and-features selection slice shared by the SCM onboarding
 * step (`ScmPlatformFeatures`) and the SCM-first project creation surface.
 * Renders the auto-detected platform cards (when an SCM repo is connected
 * and platforms were detected), the manual platform search dropdown, and
 * the feature selection / info cards. Owns platform detection, feature
 * metadata fetching, manual-picker toggle state, and the platform-selected
 * / feature-toggled / step-viewed / change-platform analytics.
 *
 * Does NOT render the step's surrounding chrome (page heading, "Choose
 * your SDK" subheading and description, Back / Continue footer). Hosts
 * compose the chrome they need around this component.
 */
export function ScmPlatformFeaturesCore({
  analyticsFlow,
  onClearProjectDetailsForm,
  onFeaturesChange,
  onPlatformChange,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
}: ScmPlatformFeaturesCoreProps) {
  const {openModal} = useModal();
  const organization = useOrganization();
  // Trial/billing framing (the "unlimited volume" banner and per-feature volume
  // limits) only makes sense during new-org onboarding, where a fresh trial is
  // always active. In SCM-first project creation the viewer is an existing org
  // on an unknown plan, so we hide that framing rather than show numbers that
  // may not apply.
  const isOnboarding = analyticsFlow === 'onboarding';
  // Fetch feature meta at step entry so billing-config is in flight (or cached)
  // before the user reaches the feature cards below.
  const {meta: featureMeta, isLoading: isFeatureMetaLoading} = useScmFeatureMeta();

  const [showManualPicker, setShowManualPicker] = useState(false);
  // Guards the auto-detect analytics event below so it fires once per repo.
  const autoDetectionTrackedRef = useRef(false);

  // Reset repo-derived state when the user changes repositories: surface the
  // freshly-detected platforms for the new repo instead of leaving the manual
  // picker visible, and re-arm the auto-detect analytics event so it can fire
  // for the new repo. Keyed on externalId since it is stable across the
  // optimistic -> resolved transition for a given selection.
  useEffect(() => {
    setShowManualPicker(false);
    autoDetectionTrackedRef.current = false;
  }, [selectedRepository?.externalId]);

  useEffect(() => {
    trackAnalytics(STEP_VIEWED_EVENT[analyticsFlow], {organization});
  }, [organization, analyticsFlow]);

  const setPlatform = useCallback(
    (platformKey: PlatformKey) => {
      const info = getPlatformInfo(platformKey);
      if (info) {
        onPlatformChange(toSelectedSdk(info));
      }
    },
    [onPlatformChange]
  );

  const hasScmConnected = !!selectedRepository;

  const {
    detectedPlatforms,
    isPending: isDetecting,
    isError: isDetectionError,
  } = useScmPlatformDetection(selectedRepository);

  const currentFeatures = useMemo(
    () => selectedFeatures ?? [ProductSolution.ERROR_MONITORING],
    [selectedFeatures]
  );

  const resolvedPlatforms = useMemo(
    () =>
      detectedPlatforms.reduce<ResolvedPlatform[]>((acc, detected) => {
        const info = getPlatformInfo(detected.platform);
        if (info) {
          acc.push({...detected, info});
        }
        return acc;
      }, []),
    [detectedPlatforms]
  );

  const detectedPlatformKey = resolvedPlatforms[0]?.platform;
  // Derive platform from explicit selection, falling back to first detected
  const currentPlatformKey = selectedPlatform?.key ?? detectedPlatformKey;

  const currentPlatformName = getPlatformName(currentPlatformKey);

  // Adopt the first detected platform once per repo when the user hasn't
  // explicitly chosen one: commit it to the host so flows without a Continue
  // boundary (single-view project creation) get a platform without an explicit
  // pick, and fire scm_platform_selected so a user who just accepts the
  // recommendation still emits a platform-selected funnel step. The ref is
  // re-armed on repo change above so a switch to a new repo adopts again.
  useEffect(() => {
    if (
      autoDetectionTrackedRef.current ||
      !detectedPlatformKey ||
      selectedPlatform?.key
    ) {
      return;
    }
    autoDetectionTrackedRef.current = true;
    setPlatform(detectedPlatformKey);
    trackAnalytics(PLATFORM_SELECTED_EVENT[analyticsFlow], {
      organization,
      platform: detectedPlatformKey,
      source: 'detected',
    });
  }, [
    detectedPlatformKey,
    selectedPlatform?.key,
    organization,
    analyticsFlow,
    setPlatform,
  ]);

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

  const applyPlatformSelection = (sdk: OnboardingSelectedSDK) => {
    onPlatformChange(sdk);
    onFeaturesChange([ProductSolution.ERROR_MONITORING]);
    onClearProjectDetailsForm();
  };

  const handleManualPlatformSelect = async (option: {value: string}) => {
    const platformKey = option.value as PlatformKey;
    if (platformKey === selectedPlatform?.key) {
      return;
    }

    // Block disabled gaming/console platforms
    const platformInfo = getPlatformInfo(platformKey);
    if (
      platformInfo &&
      isDisabledGamingPlatform({
        platform: platformInfo,
        enabledConsolePlatforms: organization.enabledConsolePlatforms,
      })
    ) {
      openConsoleModal({
        organization,
        selectedPlatform: toSelectedSdk(platformInfo),
        origin: analyticsFlow,
      });
      return;
    }

    // For base languages (JavaScript, Python, etc.), show a modal suggesting
    // specific frameworks — matching the legacy onboarding behavior.
    if (platformInfo && shouldSuggestFramework(platformKey)) {
      const baseSdk = toSelectedSdk(platformInfo);

      const {FrameworkSuggestionModal, modalCss} =
        await import('sentry/components/onboarding/frameworkSuggestionModal');

      openModal(
        deps => (
          <FrameworkSuggestionModal
            {...deps}
            organization={organization}
            selectedPlatform={baseSdk}
            onConfigure={selectedFramework => {
              applyPlatformSelection(selectedFramework);
              closeModal();
            }}
            onSkip={() => {
              applyPlatformSelection(baseSdk);
              closeModal();
            }}
            newOrg={analyticsFlow === 'onboarding'}
            hasScmOnboarding
            analyticsFlow={analyticsFlow}
          />
        ),
        {modalCss}
      );
      return;
    }

    setPlatform(platformKey);
    onFeaturesChange([ProductSolution.ERROR_MONITORING]);
    onClearProjectDetailsForm();

    trackAnalytics(PLATFORM_SELECTED_EVENT[analyticsFlow], {
      organization,
      platform: platformKey,
      source: 'manual',
    });
  };

  const handleSelectDetectedPlatform = (platformKey: PlatformKey) => {
    if (platformKey === selectedPlatform?.key) {
      return;
    }
    setPlatform(platformKey);
    onFeaturesChange([ProductSolution.ERROR_MONITORING]);
    onClearProjectDetailsForm();

    trackAnalytics(PLATFORM_SELECTED_EVENT[analyticsFlow], {
      organization,
      platform: platformKey,
      source: 'detected',
    });
  };

  function handleChangePlatformClick() {
    setShowManualPicker(true);
    // Distinguish bailing *while detection is still running* (a latency-driven
    // abandonment signal) from changing an already-detected platform.
    if (isDetecting) {
      trackAnalytics(SKIP_DETECTION_CLICKED_EVENT[analyticsFlow], {
        organization,
      });
    } else {
      trackAnalytics(CHANGE_PLATFORM_CLICKED_EVENT[analyticsFlow], {
        organization,
      });
    }
  }

  function handleBackToRecommended() {
    setShowManualPicker(false);
    if (detectedPlatformKey) {
      setPlatform(detectedPlatformKey);
      onFeaturesChange([ProductSolution.ERROR_MONITORING]);
      onClearProjectDetailsForm();
    }
  }

  // Ensure the selected platform is always present in the dropdown options
  // so the Select can resolve and display it. When the framework suggestion
  // modal picks a key not in the static list, prepend it.
  const manualPickerOptions = useMemo(() => {
    const key = currentPlatformKey;
    if (!key || platformOptions.some(o => o.value === key)) {
      return platformOptions;
    }
    const info = getPlatformInfo(key);
    if (!info) {
      return platformOptions;
    }
    return [
      {
        value: info.id,
        label: info.name,
        textValue: `${info.name} ${info.id}`,
        leadingItems: <PlatformIcon platform={info.id} size={16} />,
      },
      ...platformOptions,
    ];
  }, [currentPlatformKey]);

  // If the user previously selected a platform manually (not in the detected
  // list), show the manual picker so their selection is visible.
  const currentPlatformIsDetected = resolvedPlatforms.some(
    p => p.platform === currentPlatformKey
  );
  const hasDetectedPlatforms = resolvedPlatforms.length > 0 || isDetecting;
  // Fall through to manual picker on detection error
  const showDetectedPlatforms =
    hasScmConnected &&
    !showManualPicker &&
    !isDetectionError &&
    hasDetectedPlatforms &&
    (!currentPlatformKey || currentPlatformIsDetected);

  return (
    <Fragment>
      {showDetectedPlatforms ? (
        <MotionStack
          key="detected"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          gap="md"
          width="100%"
        >
          <Flex justify="between" align="center">
            <Flex align="center" gap="sm">
              <IconBroadcast size="sm" variant="secondary" />
              <Text variant="secondary" bold size="sm" density="comfortable" uppercase>
                {t('Auto-detected from your repository')}
              </Text>
            </Flex>
            <Button size="xs" variant="link" onClick={handleChangePlatformClick}>
              {isDetecting
                ? t('Skip detection and select manually')
                : t("Doesn't look right? Change platform")}
            </Button>
          </Flex>
          <Stack gap="lg" width="100%">
            {isDetecting ? (
              <Flex justify="center">
                <LoadingIndicator mini />
              </Flex>
            ) : (
              <Grid
                columns={{
                  xs: '1fr',
                  md: `repeat(${resolvedPlatforms.length}, minmax(200px, 1fr))`,
                }}
                width="100%"
                justify="center"
                gap="md"
                role="radiogroup"
              >
                {resolvedPlatforms.map(({platform, info}) => (
                  <ScmPlatformCard
                    key={platform}
                    platform={platform}
                    name={info.name}
                    type={info.type}
                    isSelected={currentPlatformKey === platform}
                    onClick={() => handleSelectDetectedPlatform(platform)}
                  />
                ))}
              </Grid>
            )}
          </Stack>
        </MotionStack>
      ) : (
        <MotionStack
          key="manual"
          gap="md"
          width="100%"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
        >
          <Flex justify="between" align="center">
            <Flex align="center" gap="sm">
              <IconGeneric size="sm" variant="secondary" />
              <Text variant="secondary" bold size="sm" density="comfortable" uppercase>
                {t('Select a platform')}
              </Text>
            </Flex>
            {hasScmConnected && !isDetectionError && hasDetectedPlatforms && (
              <Button size="xs" variant="link" onClick={handleBackToRecommended}>
                {t('Back to recommended platforms')}
              </Button>
            )}
          </Flex>
          <Select<(typeof platformOptions)[number]>
            placeholder={t('Search SDKs...')}
            options={manualPickerOptions}
            value={currentPlatformKey ?? null}
            onChange={option => {
              if (option) {
                handleManualPlatformSelect(option);
              }
            }}
            searchable
            components={{
              Control: ScmSearchControl,
              MenuList: ScmVirtualizedMenuList,
            }}
            styles={{container: base => ({...base, width: '100%'})}}
          />
        </MotionStack>
      )}
      {featureMode !== 'none' && (
        <MotionStack layout="position" width="100%">
          <Stack gap="2xl" paddingTop="xs">
            {isOnboarding && (
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
            )}
            {featureMode === 'toggleable' ? (
              <ScmFeatureSelectionCards
                availableFeatures={availableFeatures}
                selectedFeatures={currentFeatures}
                disabledProducts={disabledProducts}
                onToggleFeature={handleToggleFeature}
                featureMeta={featureMeta}
                isVolumeLoading={isFeatureMetaLoading}
                showVolume={isOnboarding}
              />
            ) : (
              <ScmFeatureInfoCards
                availableFeatures={availableFeatures}
                disabledProducts={disabledProducts}
                featureMeta={featureMeta}
                platformName={currentPlatformName}
                isVolumeLoading={isFeatureMetaLoading}
                showVolume={isOnboarding}
              />
            )}
          </Stack>
        </MotionStack>
      )}
    </Fragment>
  );
}

const MotionStack = motion.create(Stack);
