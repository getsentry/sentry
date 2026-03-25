import {useCallback, useEffect, useMemo, useState} from 'react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Heading} from '@sentry/scraps/text';

import {closeModal, openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {platforms} from 'sentry/data/platforms';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ScmFeatureSelectionCards} from 'sentry/views/onboarding/components/scmFeatureSelectionCards';
import {ScmPlatformCard} from 'sentry/views/onboarding/components/scmPlatformCard';

import {ScmStepFooter} from './components/scmStepFooter';
import {ScmStepHeader} from './components/scmStepHeader';
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
  leadingItems: <PlatformIcon platform={platform.id} size={16} />,
}));

/**
 * Custom Control that prepends a search icon inside the Select input.
 * Props are typed as `any` because react-select's generic types don't
 * match the specific option shape our Select wrapper uses. This matches
 * the pattern used in scmRepoSelector and elsewhere in the codebase.
 */
function SearchControl({children, ...props}: any) {
  return (
    <selectComponents.Control {...props}>
      <IconSearch size="sm" variant="muted" style={{marginLeft: 12, flexShrink: 0}} />
      {children}
    </selectComponents.Control>
  );
}

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

  const {detectedPlatforms, isPending: isDetecting} = useScmPlatformDetection(
    hasScmConnected ? selectedRepository.id : undefined
  );

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

  // If the user previously selected a platform manually (not in the detected
  // list), show the manual picker so their selection is visible.
  const currentPlatformIsDetected = resolvedPlatforms.some(
    p => p.platform === currentPlatformKey
  );
  const hasDetectedPlatforms = resolvedPlatforms.length > 0 || isDetecting;
  const showDetectedPlatforms =
    hasScmConnected &&
    !showManualPicker &&
    hasDetectedPlatforms &&
    (!currentPlatformKey || currentPlatformIsDetected);

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        stepNumber={2}
        heading={t('Platform & features')}
        subtitle={t('Select your SDK first, then choose the features to enable.')}
      />

      <Stack gap="lg" width="100%" maxWidth={PLATFORM_CONTENT_WIDTH}>
        {showDetectedPlatforms ? (
          <motion.div {...SCM_STEP_FADE_IN}>
            <Stack gap="md">
              <Heading as="h3">{t('Recommended SDK')}</Heading>
              {isDetecting ? (
                <Flex justify="center" padding="xl">
                  <LoadingIndicator mini />
                </Flex>
              ) : (
                <Stack gap="sm">
                  <Flex gap="md" wrap="wrap" role="radiogroup">
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
                  </Flex>
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
            </Stack>
          </motion.div>
        ) : (
          <motion.div {...SCM_STEP_FADE_IN}>
            <Stack gap="md" align="center">
              <Heading as="h3">{t('Select a platform')}</Heading>
              <Select
                placeholder={t('Search 100+ SDKs by name, package, or description...')}
                options={platformOptions}
                value={currentPlatformKey ?? null}
                onChange={option => {
                  if (option) {
                    handleManualPlatformSelect(option);
                  }
                }}
                searchable
                components={{Control: SearchControl}}
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
            </Stack>
          </motion.div>
        )}

        {availableFeatures.length > 0 && (
          <motion.div {...scmStepFadeIn(0.1)}>
            <ScmFeatureSelectionCards
              availableFeatures={availableFeatures}
              selectedFeatures={currentFeatures}
              disabledProducts={disabledProducts}
              onToggleFeature={handleToggleFeature}
            />
          </motion.div>
        )}
      </Stack>

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
