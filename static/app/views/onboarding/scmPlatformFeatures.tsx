import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ScmFeatureSelectionPanel} from 'sentry/components/onboarding/scm/scmFeatureSelectionPanel';
import {ScmPlatformFeaturesCore} from 'sentry/components/onboarding/scm/scmPlatformFeaturesCore';
import {
  DEFAULT_SCM_FEATURES,
  getPlatformInfo,
  toSelectedSdk,
} from 'sentry/components/onboarding/scm/scmPlatformHelpers';
import {ScmStepLayout} from 'sentry/components/onboarding/scm/scmStepLayout';
import {useScmPlatformDetection} from 'sentry/components/onboarding/scm/useScmPlatformDetection';
import {useScmProjectCreation} from 'sentry/components/onboarding/scm/useScmProjectCreation';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import type {StepProps} from './types';

interface ScmPlatformFeaturesProps {
  createdProjectSlug: string | undefined;
  deferProjectCreation: boolean;
  onComplete: StepProps['onComplete'];
  onFeaturesChange: (features: ProductSolution[] | undefined) => void;
  onPlatformChange: (platform: OnboardingSelectedSDK | undefined) => void;
  onProjectCreated: (slug: string | undefined) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
  genBackButton?: StepProps['genBackButton'];
}

export function ScmPlatformFeatures({
  createdProjectSlug,
  deferProjectCreation,
  onComplete,
  onFeaturesChange,
  onPlatformChange,
  onProjectCreated,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
  genBackButton,
}: ScmPlatformFeaturesProps) {
  const {createOrReuseProject, isCreating, isDataPending} = useScmProjectCreation({
    createdProjectSlug,
    onProjectCreated,
    selectedRepository,
  });

  // React Query dedupes with the core's call; we only need detectedPlatformKey
  // here so handleContinue's auto-create path can fall back to the
  // auto-detected platform when the user clicks Continue without an explicit
  // selection.
  const {detectedPlatforms} = useScmPlatformDetection(selectedRepository);
  // Mirror the core's filtering: only fall back to a detected platform the
  // client recognizes. An unknown key from detection would otherwise enable
  // Continue while handleContinue's getPlatformInfo lookup returns undefined,
  // stranding the user on a no-op click.
  const detectedPlatformKey = detectedPlatforms.find(p =>
    getPlatformInfo(p.platform)
  )?.platform;
  const currentPlatformKey = selectedPlatform?.key ?? detectedPlatformKey;

  const currentFeatures = selectedFeatures ?? DEFAULT_SCM_FEATURES;

  const setPlatform = (platformKey: typeof currentPlatformKey) => {
    if (!platformKey) {
      return;
    }
    const info = getPlatformInfo(platformKey);
    if (info) {
      onPlatformChange(toSelectedSdk(info));
    }
  };

  // Control auto-creates the project and needs both stores loaded. Treatment
  // only stages platform/features here; its messaging step owns creation.
  const autoCreateDataPending = !deferProjectCreation && isDataPending;

  async function handleContinue() {
    // Persist derived defaults if the user accepted them without an explicit click
    if (currentPlatformKey && !selectedPlatform?.key) {
      setPlatform(currentPlatformKey);
    }
    if (!selectedFeatures) {
      onFeaturesChange(currentFeatures);
    }

    // Auto-create the project with defaults, then advance to setup-docs.
    if (!currentPlatformKey) {
      return;
    }
    const info = getPlatformInfo(currentPlatformKey);
    if (!info) {
      return;
    }
    const platform = selectedPlatform ?? toSelectedSdk(info);

    if (deferProjectCreation) {
      onComplete(platform, {product: currentFeatures});
      return;
    }

    // `platform` is forwarded because setPlatform's context update has not
    // propagated to the captured onComplete closure yet, and goNextStep's
    // SETUP_DOCS guard would otherwise block navigation.
    await createOrReuseProject({
      platform,
      onSuccess: () => onComplete(platform, {product: currentFeatures}),
    });
  }

  return (
    // The onboarding flow has no page-level query container (project creation
    // resolves against `#main`), and the flow's fixed footers preclude one
    // higher up, so each SCM step declares its own.
    <Stack containerType="inline-size">
      <ScmStepLayout>
        <Stack gap="lg" paddingBottom="2xl">
          <Heading as="h2" size="3xl" align="center">
            {t('Create your first project')}
          </Heading>
          <Text
            align="center"
            variant="muted"
            size="lg"
            density="comfortable"
            wrap="pre-line"
          >
            {t(
              'A project holds everything Sentry collects from one app or service.\nStart with one, add more later.'
            )}
          </Text>
        </Stack>
        <LayoutGroup>
          <Stack gap="lg">
            <Heading as="h3" size="lg">
              {t('What’s your app built with?')}
            </Heading>
            <ScmPlatformFeaturesCore
              analyticsFlow="onboarding"
              selectedRepository={selectedRepository}
              selectedPlatform={selectedPlatform}
              onPlatformChange={onPlatformChange}
              onFeaturesChange={onFeaturesChange}
            />
          </Stack>
          <ScmFeatureSelectionPanel
            analyticsFlow="onboarding"
            selectedRepository={selectedRepository}
            selectedPlatform={selectedPlatform}
            selectedFeatures={selectedFeatures}
            onFeaturesChange={onFeaturesChange}
          />
          <MotionFlex
            layout="position"
            align="center"
            justify="between"
            gap="md"
            width="100%"
            paddingTop="2xl"
          >
            <Flex align="center">{genBackButton?.()}</Flex>
            <Flex align="center" gap="md">
              <Button
                variant="primary"
                analyticsEventKey="onboarding.scm_platform_features_continue_clicked"
                analyticsEventName="Onboarding: SCM Platform Features Continue Clicked"
                analyticsParams={{
                  platform: currentPlatformKey ?? '',
                  features: currentFeatures,
                }}
                onClick={handleContinue}
                disabled={!currentPlatformKey || isCreating || autoCreateDataPending}
                busy={isCreating}
              >
                {t('Continue')}
              </Button>
            </Flex>
          </MotionFlex>
        </LayoutGroup>
      </ScmStepLayout>
    </Stack>
  );
}

const MotionFlex = motion.create(Flex);
