import * as Sentry from '@sentry/react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import {ScmFeatureSelectionPanel} from './components/scmFeatureSelectionPanel';
import {ScmPlatformFeaturesCore} from './components/scmPlatformFeaturesCore';
import {
  DEFAULT_SCM_FEATURES,
  getPlatformInfo,
  toSelectedSdk,
} from './components/scmPlatformHelpers';
import {useScmPlatformDetection} from './components/useScmPlatformDetection';
import type {StepProps} from './types';

interface ScmPlatformFeaturesProps {
  createdProjectSlug: string | undefined;
  onClearProjectDetailsForm: () => void;
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
  onClearProjectDetailsForm,
  onComplete,
  onFeaturesChange,
  onPlatformChange,
  onProjectCreated,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
  genBackButton,
}: ScmPlatformFeaturesProps) {
  const organization = useOrganization();

  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProject = useCreateProject();
  // Exposure is reported upstream in onboarding.tsx when the user enters SCM
  // onboarding; skip it here to avoid double-counting on step mount.
  const {inExperiment: hasProjectDetailsStep} = useExperiment({
    feature: 'onboarding-scm-project-details-experiment',
    reportExposure: false,
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

  const existingProject = createdProjectSlug
    ? projects.find(p => p.slug === createdProjectSlug)
    : undefined;

  // When the project-details step is skipped, Continue auto-creates the
  // project, which needs the teams and projects stores loaded.
  const autoCreateDataPending =
    !hasProjectDetailsStep && (isLoadingTeams || !projectsLoaded);

  async function handleContinue() {
    // Persist derived defaults if the user accepted them without an explicit click
    if (currentPlatformKey && !selectedPlatform?.key) {
      setPlatform(currentPlatformKey);
    }
    if (!selectedFeatures) {
      onFeaturesChange(currentFeatures);
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
        onProjectCreated(project.slug);

        if (selectedRepository?.id) {
          try {
            await fetchMutation({
              url: `/projects/${organization.slug}/${project.slug}/repo/`,
              method: 'POST',
              data: {repositoryId: selectedRepository.id},
            });
          } catch (error) {
            Sentry.captureException(error);
          }
        }

        onComplete(platform, {product: currentFeatures});
      } catch (error) {
        addErrorMessage(t('Failed to create project'));
        Sentry.captureException(error);
      }
      return;
    }

    onComplete();
  }

  return (
    <Stack align="center" gap="2xl" flexGrow={1}>
      <Stack gap="3xl" maxWidth={SCM_STEP_CONTENT_WIDTH}>
        <Heading as="h2" size="4xl">
          {t('Create your first project')}
        </Heading>
        <LayoutGroup>
          <Stack gap="md" paddingTop="sm">
            <Heading as="h3" size="lg">
              {t('Choose your SDK')}
            </Heading>
            <Container>
              <Text variant="muted" size="md" density="comfortable">
                {t(
                  'Each Sentry project collects data from one service or app. Select a language or framework you want to get started monitoring with our SDKs.'
                )}
              </Text>
            </Container>
          </Stack>
          <ScmPlatformFeaturesCore
            analyticsFlow="onboarding"
            selectedRepository={selectedRepository}
            selectedPlatform={selectedPlatform}
            onPlatformChange={onPlatformChange}
            onFeaturesChange={onFeaturesChange}
            onClearProjectDetailsForm={onClearProjectDetailsForm}
          />
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
            width="100%"
            paddingTop="sm"
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
    </Stack>
  );
}

const MotionFlex = motion.create(Flex);
