import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {LayoutGroup, motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {closeModal, openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  getDisabledProducts,
  platformProductAvailability,
} from 'sentry/components/onboarding/productSelection';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {platforms} from 'sentry/data/platforms';
import {IconBroadcast, IconBusiness, IconGeneric} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {ScmFeatureSelectionCards} from 'sentry/views/onboarding/components/scmFeatureSelectionCards';
import {ScmPlatformCard} from 'sentry/views/onboarding/components/scmPlatformCard';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import {ScmSearchControl} from './components/scmSearchControl';
import {ScmVirtualizedMenuList} from './components/scmVirtualizedMenuList';
import {
  useScmPlatformDetection,
  type DetectedPlatform,
} from './components/useScmPlatformDetection';
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

export function ScmPlatformFeatures({onComplete, genBackButton}: StepProps) {
  const organization = useOrganization();
  const {
    selectedRepository,
    selectedPlatform,
    setSelectedPlatform,
    selectedFeatures,
    setSelectedFeatures,
    setProjectDetailsForm,
    createdProjectSlug,
    setCreatedProjectSlug,
  } = useOnboardingContext();

  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProject = useCreateProject();
  // Exposure is reported upstream in onboarding.tsx when the user enters SCM
  // onboarding; skip it here to avoid double-counting on step mount.
  const {inExperiment: hasProjectDetailsStep} = useExperiment({
    feature: 'onboarding-scm-project-details-experiment',
    reportExposure: false,
  });

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

  // Fire scm_platform_selected once when detection auto-resolves a platform
  // and the user hasn't explicitly chosen one. Otherwise a user who accepts
  // the recommendation and clicks Continue never emits the event, leaving
  // the funnel without a platform-selected step.
  const autoDetectionTrackedRef = useRef(false);
  useEffect(() => {
    if (
      autoDetectionTrackedRef.current ||
      !detectedPlatformKey ||
      selectedPlatform?.key
    ) {
      return;
    }
    autoDetectionTrackedRef.current = true;
    trackAnalytics('onboarding.scm_platform_selected', {
      organization,
      platform: detectedPlatformKey,
      source: 'detected',
    });
  }, [detectedPlatformKey, selectedPlatform?.key, organization]);

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

  const applyPlatformSelection = (sdk: OnboardingSelectedSDK) => {
    setSelectedPlatform(sdk);
    setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    setProjectDetailsForm(undefined);
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
            hasScmOnboarding
          />
        ),
        {modalCss}
      );
      return;
    }

    setPlatform(platformKey);
    setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    setProjectDetailsForm(undefined);

    trackAnalytics('onboarding.scm_platform_selected', {
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
    setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    setProjectDetailsForm(undefined);

    trackAnalytics('onboarding.scm_platform_selected', {
      organization,
      platform: platformKey,
      source: 'detected',
    });
  };

  function handleChangePlatformClick() {
    setShowManualPicker(true);
    if (!isDetecting) {
      trackAnalytics('onboarding.scm_platform_change_platform_clicked', {
        organization,
      });
    }
  }

  function handleBackToRecommended() {
    setShowManualPicker(false);
    if (detectedPlatformKey) {
      setPlatform(detectedPlatformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
      setProjectDetailsForm(undefined);
    }
  }

  const existingProject = createdProjectSlug
    ? projects.find(p => p.slug === createdProjectSlug)
    : undefined;

  // When the project-details step is skipped, Continue auto-creates the
  // project, which needs the teams and projects stores loaded.
  const autoCreateDataPending =
    !hasProjectDetailsStep && (isLoadingTeams || !projectsLoaded);

  async function handleContinue() {
    // Persist derived defaults to context if user accepted them
    if (currentPlatformKey && !selectedPlatform?.key) {
      setPlatform(currentPlatformKey);
    }
    if (!selectedFeatures) {
      setSelectedFeatures(currentFeatures);
    }

    if (!hasProjectDetailsStep) {
      // Auto-create project with defaults when SCM_PROJECT_DETAILS step is skipped
      if (!currentPlatformKey) {
        return;
      }
      const info = getPlatformInfo(currentPlatformKey);
      if (!info) {
        return;
      }
      const platform = selectedPlatform ?? toSelectedSdk(info);

      // If a project was already created for this platform (e.g. the user
      // went back after the project received its first event), reuse it.
      // If the platform changed, abandon the old project and create a new
      // one — matching legacy onboarding behavior.
      // `platform` is forwarded because setPlatform's context update has not
      // propagated to the captured onComplete closure yet, and goNextStep's
      // SETUP_DOCS guard would otherwise block navigation.
      if (existingProject?.platform === platform.key) {
        onComplete(platform, {product: currentFeatures});
        return;
      }

      const firstAdminTeam = teams.find((team: Team) =>
        team.access.includes('team:admin')
      );

      try {
        const project = await createProject.mutateAsync({
          name: platform.key,
          platform,
          default_rules: true,
          firstTeamSlug: firstAdminTeam?.slug,
        });
        setCreatedProjectSlug(project.slug);
        onComplete(platform, {product: currentFeatures});
      } catch (error) {
        addErrorMessage(t('Failed to create project'));
        Sentry.captureException(error);
      }
      return;
    }

    onComplete();
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
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <Stack gap="3xl" maxWidth={SCM_STEP_CONTENT_WIDTH}>
        <Heading as="h2" size="4xl">
          {t('Create your first project')}
        </Heading>
        <LayoutGroup>
          <Stack gap="md" paddingTop="sm">
            <Heading as="h3" size="xl">
              {t('Choose your SDK')}
            </Heading>
            <Text variant="muted" size="lg" density="comfortable">
              {t(
                'Each Sentry project collects data from one service or app. Select a language or framework you want to get started monitoring with our SDKs.'
              )}
            </Text>
          </Stack>
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
                  <Text
                    variant="secondary"
                    bold
                    size="sm"
                    density="comfortable"
                    uppercase
                  >
                    {t('Auto-detected from your repository')}
                  </Text>
                </Flex>
                <Button size="xs" priority="link" onClick={handleChangePlatformClick}>
                  {isDetecting
                    ? t('Skip detection and select manually')
                    : t("Doesn't look right? Change platform")}
                </Button>
              </Flex>
              <Stack gap="lg" width="100%">
                {isDetecting ? (
                  <LoadingIndicator mini />
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
                  <Text
                    variant="secondary"
                    bold
                    size="sm"
                    density="comfortable"
                    uppercase
                  >
                    {t('Select a platform')}
                  </Text>
                </Flex>
                {hasScmConnected && !isDetectionError && hasDetectedPlatforms && (
                  <Button size="xs" priority="link" onClick={handleBackToRecommended}>
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
          <MotionStack layout="position" width="100%">
            {availableFeatures.length > 0 && (
              <Stack gap="2xl" paddingTop="xs">
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
                <ScmFeatureSelectionCards
                  availableFeatures={availableFeatures}
                  selectedFeatures={currentFeatures}
                  disabledProducts={disabledProducts}
                  onToggleFeature={handleToggleFeature}
                />
              </Stack>
            )}
          </MotionStack>
          <MotionFlex
            layout="position"
            align="center"
            justify="between"
            width="100%"
            paddingTop="sm"
          >
            <Flex align="center">{genBackButton?.()}</Flex>
            <Flex align="center" gap="md">
              <Button
                priority="primary"
                analyticsEventKey="onboarding.scm_platform_features_continue_clicked"
                analyticsEventName="Onboarding: SCM Platform Features Continue Clicked"
                analyticsParams={{
                  platform: currentPlatformKey ?? '',
                  source: showDetectedPlatforms ? 'detected' : 'manual',
                  features: currentFeatures,
                }}
                onClick={handleContinue}
                disabled={
                  !currentPlatformKey || createProject.isPending || autoCreateDataPending
                }
                busy={createProject.isPending}
              >
                {t('Continue')}
              </Button>
            </Flex>
          </MotionFlex>
        </LayoutGroup>
      </Stack>
    </Flex>
  );
}

const MotionStack = motion.create(Stack);
const MotionFlex = motion.create(Flex);
