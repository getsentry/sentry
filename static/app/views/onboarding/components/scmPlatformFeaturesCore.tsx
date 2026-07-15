import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Select} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import {closeModal, openConsoleModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmPlatformCard} from './scmPlatformCard';
import {
  DEFAULT_SCM_FEATURES,
  getPlatformInfo,
  platformOptions,
  shouldSuggestFramework,
  toSelectedSdk,
} from './scmPlatformHelpers';
import {ScmSearchControl} from './scmSearchControl';
import {ScmVirtualizedMenuList} from './scmVirtualizedMenuList';
import {useScmResolvedPlatform} from './useScmResolvedPlatform';

const PLATFORM_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_platform_selected',
  'project-creation': 'project_creation.scm_platform_selected',
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
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

/**
 * Platform-selection slice shared by the SCM onboarding step
 * (`ScmPlatformFeatures`) and the SCM-first project creation surface. Renders
 * the auto-detected platform cards (when an SCM repo is connected and platforms
 * were detected) and the manual platform search dropdown. Feature selection is
 * rendered separately as a sibling (`ScmFeatureSelectionPanel`). Owns platform
 * detection, manual-picker toggle state, and the platform-selected /
 * step-viewed / change-platform analytics.
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
  selectedPlatform,
  selectedRepository,
}: ScmPlatformFeaturesCoreProps) {
  const isOnboarding = analyticsFlow === 'onboarding';
  const {openModal} = useModal();
  const organization = useOrganization();

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
    // Onboarding views this as a discrete step. Single-view project creation
    // shows all sections at once and fires one page-viewed event in
    // scmCreateProject, so suppress the per-section step_viewed there.
    if (!isOnboarding) {
      return;
    }
    trackAnalytics('onboarding.scm_platform_features_step_viewed', {organization});
  }, [organization, isOnboarding]);

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
    resolvedPlatforms,
    detectedPlatformKey,
    currentPlatformKey,
    isDetecting,
    isDetectionError,
  } = useScmResolvedPlatform({selectedPlatform, selectedRepository});

  // Whether the active platform is one of the detected ones. Gates the
  // detected-cards view below, and lets "Back to recommended" keep a detected
  // selection (including a non-top one) rather than forcing the top detection.
  const currentPlatformIsDetected = resolvedPlatforms.some(
    p => p.platform === currentPlatformKey
  );

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

  const applyPlatformSelection = (sdk: OnboardingSelectedSDK) => {
    onPlatformChange(sdk);
    onFeaturesChange(DEFAULT_SCM_FEATURES);
    onClearProjectDetailsForm();
  };

  // Inverse of a platform selection: drop the platform and everything derived
  // from it (the default features and the platform-seeded project name).
  // Mirrors the repo selector's clearable Select. Only offered when there is no
  // detected platform to fall back to (see the Select's clearable below):
  // otherwise currentPlatformKey would keep showing the detected key while the
  // committed selectedPlatform went empty, desyncing the picker from the form
  // and stranding Create behind a "select a platform" tooltip. Reverting to a
  // detected platform is handled by "Back to recommended platforms" instead.
  const handleClearPlatform = () => {
    // Treat the clear as resolving auto-adoption for this repo, so a detection
    // request that finishes *after* an explicit clear (reachable via "Skip
    // detection and select manually" while detection is still pending) does not
    // re-adopt the detected platform and silently undo the clear.
    autoDetectionTrackedRef.current = true;
    onPlatformChange(undefined);
    onFeaturesChange(undefined);
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
            newOrg={isOnboarding}
            hasScmOnboarding
            analyticsFlow={analyticsFlow}
          />
        ),
        {modalCss}
      );
      return;
    }

    setPlatform(platformKey);
    onFeaturesChange(DEFAULT_SCM_FEATURES);
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
    onFeaturesChange(DEFAULT_SCM_FEATURES);
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
    // If the host already has a detected platform committed, just reopen the
    // cards view with it still selected. The user may have committed a non-top
    // detection (or the auto-adopted default), so forcing the top detection here
    // would clear a valid selection and wipe the derived features/form for no
    // reason. Check selectedPlatform, not currentPlatformKey: the latter falls
    // back to the top detection even when nothing is committed, so using it here
    // would skip the commit below and strand Create behind an empty
    // selectedPlatform while the cards still look selected.
    const selectedIsDetected = resolvedPlatforms.some(
      p => p.platform === selectedPlatform?.key
    );
    if (selectedIsDetected || !detectedPlatformKey) {
      return;
    }
    setPlatform(detectedPlatformKey);
    onFeaturesChange(DEFAULT_SCM_FEATURES);
    onClearProjectDetailsForm();
    // Leaving a manual pick for the detected platform is itself a platform
    // selection, so record it as the detected source (mirrors the auto-adopt
    // path and handleSelectDetectedPlatform, which were the only detected-source
    // emitters before).
    trackAnalytics(PLATFORM_SELECTED_EVENT[analyticsFlow], {
      organization,
      platform: detectedPlatformKey,
      source: 'detected',
    });
  }

  // Shared by both manual-picker variants. A null option is the clear action,
  // which is only reachable from the clearable variant (no detected fallback).
  const handleManualPickerChange = (option: (typeof platformOptions)[number] | null) => {
    if (option) {
      handleManualPlatformSelect(option);
    } else {
      handleClearPlatform();
    }
  };

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

  // When the active platform is a manual (non-detected) pick, show the manual
  // picker so the selection stays visible (see showDetectedPlatforms below).
  const hasDetectedPlatforms = resolvedPlatforms.length > 0 || isDetecting;
  // Fall through to manual picker on detection error
  const showDetectedPlatforms =
    hasScmConnected &&
    !showManualPicker &&
    !isDetectionError &&
    hasDetectedPlatforms &&
    (!currentPlatformKey || currentPlatformIsDetected);

  return showDetectedPlatforms ? (
    <MotionStack
      key="detected"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      gap="lg"
      width="100%"
    >
      <Flex
        justify="between"
        align={{'screen:xs': 'start', 'screen:sm': 'center'}}
        gap="md"
        direction={{'screen:xs': 'column', 'screen:sm': 'row'}}
      >
        <Flex align="center" gap="sm">
          <Flex flexShrink={0}>
            <IconBroadcast size="sm" />
          </Flex>
          <Heading as="h4">{t('Auto-detected from your repository')}</Heading>
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
              'screen:xs': '1fr',
              'screen:md':
                resolvedPlatforms.length < 3
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(3, minmax(0, 1fr))',
            }}
            width="100%"
            justify="start"
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
      <Flex justify="between" align="end">
        <Flex gap="sm" direction={isOnboarding ? undefined : 'column'}>
          <Heading as="h4">
            {isOnboarding ? t('Select a platform') : t('Platform')}
          </Heading>
          {isOnboarding ? null : (
            <Text variant="secondary" density="comfortable" size="sm">
              {t('Determines your SDK and available monitoring features')}
            </Text>
          )}
        </Flex>
        {hasScmConnected && !isDetectionError && hasDetectedPlatforms && (
          <Button size="xs" variant="link" onClick={handleBackToRecommended}>
            {t('Back to recommended platforms')}
          </Button>
        )}
      </Flex>
      {/* Two literal variants instead of clearable={!detectedPlatformKey}: the
          core Select types `clearable` as a discriminated-union literal (`?: false`
          vs `: true`, which also selects the onChange signature), so a dynamic
          boolean is not assignable and will not typecheck. Each branch passes a
          literal. Clear is only offered when no platform was detected: a detected
          one re-resolves into currentPlatformKey, so clearing would leave the
          picker (and the feature panel) showing it while the committed selection
          is empty. "Back to recommended platforms" covers reverting. */}
      {detectedPlatformKey ? (
        <Select<(typeof platformOptions)[number]>
          placeholder={t('Search SDKs...')}
          options={manualPickerOptions}
          value={currentPlatformKey ?? null}
          onChange={handleManualPickerChange}
          searchable
          components={{Control: ScmSearchControl, MenuList: ScmVirtualizedMenuList}}
          styles={{container: base => ({...base, width: '100%'})}}
        />
      ) : (
        <Select<(typeof platformOptions)[number]>
          placeholder={t('Search SDKs...')}
          options={manualPickerOptions}
          value={currentPlatformKey ?? null}
          onChange={handleManualPickerChange}
          clearable
          searchable
          components={{Control: ScmSearchControl, MenuList: ScmVirtualizedMenuList}}
          styles={{container: base => ({...base, width: '100%'})}}
        />
      )}
    </MotionStack>
  );
}

const MotionStack = motion.create(Stack);
