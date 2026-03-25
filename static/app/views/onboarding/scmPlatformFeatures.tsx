import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Heading} from '@sentry/scraps/text';

import {closeModal, openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ScmFeatureSelectionCards} from 'sentry/views/onboarding/components/scmFeatureSelectionCards';
import {ScmPlatformCard} from 'sentry/views/onboarding/components/scmPlatformCard';

import {ScmSearchControl} from './components/scmSearchControl';
import {ScmStepFooter} from './components/scmStepFooter';
import {ScmStepHeader} from './components/scmStepHeader';
import {ScmVirtualizedMenuList} from './components/scmVirtualizedMenuList';
import {
  useScmPlatformDetection,
  type DetectedPlatform,
} from './components/useScmPlatformDetection';
import {SCM_STEP_FADE_IN, scmStepFadeIn} from './consts';
import type {StepProps} from './types';

interface ResolvedPlatform extends DetectedPlatform {
  info: PlatformIntegration;
}

const platformsByKey = new Map(platforms.map(p => [p.id, p]));

const getPlatformInfo = (key: PlatformKey) => platformsByKey.get(key);

const platformOptions = platforms.map(platform => ({
  value: platform.id,
  label: platform.name,
  textValue: `${platform.name} ${platform.id}`,
  leadingItems: (<PlatformIcon platform={platform.id} size={16} />) as ReactNode,
}));

type PlatformOption = (typeof platformOptions)[number];

function toSelectedSdk(info: PlatformIntegration): OnboardingSelectedSDK {
  return {
    key: info.id,
    name: info.name,
    language: info.language,
    type: info.type,
    link: info.link,
    // PlatformIntegration doesn't carry a category — 'all' is the most
    // neutral value and avoids implying a specific picker category.
    category: 'all',
  };
}

function shouldSuggestFramework(platformKey: PlatformKey): boolean {
  const info = getPlatformInfo(platformKey);
  return (
    info?.type === 'language' &&
    Object.values(SupportedLanguages).includes(info.language as SupportedLanguages)
  );
}

// Width for the platform/feature content area (matches Figma spec).
// Wider than SCM_STEP_CONTENT_WIDTH (506px) used by the footer.
const PLATFORM_CONTENT_WIDTH = '564px';

export function ScmPlatformFeatures({onComplete}: StepProps) {
  const organization = useOrganization();
  const {
    selectedRepository,
    selectedPlatform,
    setSelectedPlatform,
    selectedFeatures,
    setSelectedFeatures,
  } = useOnboardingContext();

  const [showManualPicker, setShowManualPicker] = useState(false);

  useEffect(() => {
    trackAnalytics('onboarding.scm_platform_features_step_viewed', {organization});
  }, [organization]);

  const setPlatform = useCallback(
    (platformKey: PlatformKey) => {
      const info = getPlatformInfo(platformKey);
      if (info) {
        setSelectedPlatform(toSelectedSdk(info));
      }
    },
    [setSelectedPlatform]
  );

  const hasScmConnected = !!selectedRepository;

  const {
    detectedPlatforms,
    isPending: isDetecting,
    isError: isDetectionError,
  } = useScmPlatformDetection(hasScmConnected ? selectedRepository.id : undefined);

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

  const availableFeatures = useMemo(
    () =>
      currentPlatformKey
        ? [
            ...new Set([
              ProductSolution.ERROR_MONITORING,
              ...(platformProductAvailability[currentPlatformKey] ?? []),
            ]),
          ]
        : [],
    [currentPlatformKey]
  );

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

      setSelectedFeatures(Array.from(newFeatures));

      trackAnalytics('onboarding.scm_platform_feature_toggled', {
        organization,
        feature,
        enabled: !wasEnabled,
        platform: currentPlatformKey ?? '',
      });
    },
    [
      currentFeatures,
      setSelectedFeatures,
      disabledProducts,
      availableFeatures,
      organization,
      currentPlatformKey,
    ]
  );

  const applyPlatformSelection = useCallback(
    (sdk: OnboardingSelectedSDK) => {
      setSelectedPlatform(sdk);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [setSelectedPlatform, setSelectedFeatures]
  );

  const handleManualPlatformSelect = useCallback(
    async (option: {value: string}) => {
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
          origin: 'onboarding',
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
              newOrg
            />
          ),
          {modalCss}
        );
        return;
      }

      setPlatform(platformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);

      trackAnalytics('onboarding.scm_platform_selected', {
        organization,
        platform: platformKey,
        source: 'manual',
      });
    },
    [
      selectedPlatform?.key,
      setPlatform,
      setSelectedFeatures,
      applyPlatformSelection,
      organization,
    ]
  );

  const handleSelectDetectedPlatform = useCallback(
    (platformKey: PlatformKey) => {
      if (platformKey === selectedPlatform?.key) {
        return;
      }
      setPlatform(platformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);

      trackAnalytics('onboarding.scm_platform_selected', {
        organization,
        platform: platformKey,
        source: 'detected',
      });
    },
    [selectedPlatform?.key, setPlatform, setSelectedFeatures, organization]
  );

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
        leadingItems: (<PlatformIcon platform={info.id} size={16} />) as ReactNode,
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
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        stepNumber={2}
        heading={t('Platform & features')}
        subtitle={t('Select your SDK first, then choose the features to enable.')}
      />

      {showDetectedPlatforms && (
        <MotionStack {...SCM_STEP_FADE_IN} gap="md" align="center">
          <Heading as="h3">{t('Recommended SDK')}</Heading>
          {isDetecting ? (
            <Stack gap="md" align="center" padding="xl">
              <LoadingIndicator mini />
              <Button size="xs" priority="link" onClick={() => setShowManualPicker(true)}>
                {t('Skip detection and select manually')}
              </Button>
            </Stack>
          ) : (
            <Stack gap="sm" align="center">
              <Grid autoColumns="1fr" flow="column" gap="md" role="radiogroup">
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
              <Button
                size="xs"
                priority="link"
                onClick={() => {
                  setShowManualPicker(true);
                  trackAnalytics('onboarding.scm_platform_change_platform_clicked', {
                    organization,
                  });
                }}
              >
                {t("Doesn't look right? Change platform")}
              </Button>
            </Stack>
          )}
        </MotionStack>
      )}

      {!showDetectedPlatforms && (
        <MotionStack
          gap="md"
          align="center"
          width="100%"
          maxWidth={PLATFORM_CONTENT_WIDTH}
          {...SCM_STEP_FADE_IN}
        >
          <Heading as="h3">{t('Select a platform')}</Heading>
          <Select<PlatformOption>
            placeholder={t('Search 100+ SDKs by name, package, or description...')}
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
          {hasScmConnected && (
            <Button
              size="xs"
              priority="link"
              onClick={() => {
                setShowManualPicker(false);
                if (detectedPlatformKey) {
                  setPlatform(detectedPlatformKey);
                  setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
                }
              }}
            >
              {t('Back to recommended platforms')}
            </Button>
          )}
        </MotionStack>
      )}

      {availableFeatures.length > 0 && (
        <MotionStack
          {...scmStepFadeIn(0.1)}
          width="100%"
          maxWidth={PLATFORM_CONTENT_WIDTH}
        >
          <ScmFeatureSelectionCards
            availableFeatures={availableFeatures}
            selectedFeatures={currentFeatures}
            disabledProducts={disabledProducts}
            onToggleFeature={handleToggleFeature}
          />
        </MotionStack>
      )}

      <ScmStepFooter>
        <Button
          priority="primary"
          analyticsEventKey="onboarding.scm_platform_features_continue_clicked"
          analyticsEventName="Onboarding: SCM Platform Features Continue Clicked"
          analyticsParams={{
            platform: currentPlatformKey ?? '',
            source: showDetectedPlatforms ? 'detected' : 'manual',
            features: currentFeatures,
          }}
          onClick={() => {
            // Persist derived defaults to context if user accepted them
            if (currentPlatformKey && !selectedPlatform?.key) {
              setPlatform(currentPlatformKey);
            }
            if (!selectedFeatures) {
              setSelectedFeatures(currentFeatures);
            }
            onComplete();
          }}
          disabled={!currentPlatformKey}
        >
          {t('Continue')}
        </Button>
      </ScmStepFooter>
    </Flex>
  );
}

const MotionStack = motion.create(Stack);
