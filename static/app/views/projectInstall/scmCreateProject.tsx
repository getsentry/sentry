import {Fragment, useCallback, useEffect, useRef} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {ScmIntegrationConnect} from 'sentry/views/onboarding/components/scmIntegrationConnect';
import {ScmPlatformFeaturesCore} from 'sentry/views/onboarding/components/scmPlatformFeaturesCore';
import {useScmPlatformDetection} from 'sentry/views/onboarding/components/useScmPlatformDetection';
import {useScmProviders} from 'sentry/views/onboarding/components/useScmProviders';

const CREATE_PROJECT_MAX_WIDTH = '760px';

interface WizardState {
  // Flips true on the first meaningful action in section 1 (repo selected
  // or "Continue without connecting a repo" clicked). Sections 2 and 3
  // reveal together when this is true. Decoupled from selection state so
  // later state edits (de-selecting a repo) do not collapse the rest of
  // the page.
  repoStepCompleted: boolean;
  selectedFeatures: ProductSolution[] | undefined;
  selectedIntegration: Integration | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

const INITIAL_STATE: WizardState = {
  repoStepCompleted: false,
  selectedFeatures: undefined,
  selectedIntegration: undefined,
  selectedPlatform: undefined,
  selectedRepository: undefined,
};

export function ScmCreateProject() {
  // Session-storage backed so a refresh restores how far the user has
  // progressed. Separate key from new-org onboarding's 'onboarding' key.
  const [
    {
      repoStepCompleted,
      selectedFeatures,
      selectedIntegration,
      selectedPlatform,
      selectedRepository,
    },
    setState,
  ] = useSessionStorage('project-creation-wizard', INITIAL_STATE);

  // An optimistic repo (empty id, see useScmRepoSelection) persisted by a
  // refresh mid-resolution can never fetch detection and would hold the
  // platform step in a permanent spinner. Drop it once on load, also clearing
  // the repo-derived platform/features so section 2 doesn't show a platform
  // with no connected repo (mirrors handleClearDerivedState on a repo change).
  // Live in-session optimistic selections arrive after mount and keep their
  // loading state.
  const hadStaleRepoOnLoad = useRef(!!selectedRepository && !selectedRepository.id);
  useEffect(() => {
    if (hadStaleRepoOnLoad.current) {
      hadStaleRepoOnLoad.current = false;
      setState(s => ({
        ...s,
        selectedRepository: undefined,
        selectedPlatform: undefined,
        selectedFeatures: undefined,
      }));
    }
  }, [setState]);

  const canUserCreateProject = useCanCreateProject();
  // Subscribe so the parent re-renders when integration state changes inside
  // ScmIntegrationConnect, letting framer-motion's layout="position" siblings
  // below re-measure and animate position shifts. React Query dedupes with
  // the child's call.
  useScmProviders();

  useScmPlatformDetection(selectedRepository);

  const completeRepoStep = () => {
    setState(s => ({...s, repoStepCompleted: true}));
  };

  const handleIntegrationChange = useCallback(
    (integration: Integration | undefined) => {
      setState(s => ({...s, selectedIntegration: integration}));
    },
    [setState]
  );

  // Selecting a repo is itself a meaningful action, so it also flips the
  // reveal flag. The "Continue without connecting a repo" path flips the
  // flag via completeRepoStep below.
  const handleRepositoryChange = useCallback(
    (repository: Repository | undefined) => {
      setState(s => ({
        ...s,
        selectedRepository: repository,
        repoStepCompleted: repository ? true : s.repoStepCompleted,
      }));
    },
    [setState]
  );

  const handlePlatformChange = useCallback(
    (platform: OnboardingSelectedSDK | undefined) => {
      setState(s => ({...s, selectedPlatform: platform}));
    },
    [setState]
  );

  const handleFeaturesChange = useCallback(
    (features: ProductSolution[] | undefined) => {
      setState(s => ({...s, selectedFeatures: features}));
    },
    [setState]
  );

  // Clear state derived from the repository when the repo changes. Platform
  // and features are repo-dependent (auto-detection seeds them). VDY-76 will
  // extend this to clear the project-details form too.
  const handleClearDerivedState = useCallback(() => {
    setState(s => ({
      ...s,
      selectedPlatform: undefined,
      selectedFeatures: undefined,
    }));
  }, [setState]);

  // Clear the project-details form when the platform changes. VDY-76 will
  // wire this up to actual project-details state.
  const handleClearProjectDetailsForm = useCallback(() => {}, []);

  const showContinueWithoutRepo = !selectedRepository && !repoStepCompleted;
  const showAllSteps = repoStepCompleted;

  return (
    <SentryDocumentTitle title={t('Create a new project')}>
      <Access access={canUserCreateProject ? ['project:read'] : ['project:admin']}>
        <Stack
          flexGrow={1}
          gap="lg"
          padding="2xl"
          alignSelf="center"
          maxWidth={CREATE_PROJECT_MAX_WIDTH}
        >
          <LayoutGroup>
            <Layout.Title withMargins>{t('Create a new project')}</Layout.Title>
            <Container paddingBottom="lg">
              <Text as="p" variant="muted">
                {tct(
                  'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from. [link: Read the docs].',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/" />
                    ),
                  }
                )}
              </Text>
            </Container>

            <MotionStack
              gap="lg"
              border="primary"
              radius="md"
              padding="lg"
              layout="position"
            >
              <Stack gap="md">
                <Heading as="h2" size="xl">
                  {t('Create a new project')}
                </Heading>
                <Text variant="muted">
                  {t('Pick a platform, name your project and choose what to monitor.')}
                </Text>
              </Stack>

              <ScmIntegrationConnect
                analyticsFlow="project-creation"
                selectedIntegration={selectedIntegration}
                selectedRepository={selectedRepository}
                onIntegrationChange={handleIntegrationChange}
                onRepositoryChange={handleRepositoryChange}
                onClearDerivedState={handleClearDerivedState}
                maxWidth={CREATE_PROJECT_MAX_WIDTH}
              />
              {showContinueWithoutRepo && (
                <MotionFlex layout="position">
                  <Button
                    variant="transparent"
                    analyticsEventKey="project_creation.scm_connect_skip_clicked"
                    analyticsEventName="Project Creation: SCM Connect Skip Clicked"
                    onClick={completeRepoStep}
                  >
                    {t('Continue without connecting a repo')}
                  </Button>
                </MotionFlex>
              )}
            </MotionStack>

            {showAllSteps && (
              <Fragment>
                <MotionStack
                  layout="position"
                  gap="lg"
                  border="primary"
                  radius="md"
                  padding="lg"
                >
                  <Stack gap="md">
                    <Heading as="h2" size="xl">
                      {t('Platform & features')}
                    </Heading>
                    <Text variant="muted">
                      {t('Choose a platform and configure what to monitor.')}
                    </Text>
                  </Stack>
                  <ScmPlatformFeaturesCore
                    analyticsFlow="project-creation"
                    selectedRepository={selectedRepository}
                    selectedPlatform={selectedPlatform}
                    selectedFeatures={selectedFeatures}
                    onPlatformChange={handlePlatformChange}
                    onFeaturesChange={handleFeaturesChange}
                    onClearProjectDetailsForm={handleClearProjectDetailsForm}
                  />
                </MotionStack>
                <ProjectDetailsSection />
              </Fragment>
            )}
          </LayoutGroup>
        </Stack>
      </Access>
    </SentryDocumentTitle>
  );
}

// Placeholder for VDY-76. Will be replaced with <ScmProjectDetails />.
function ProjectDetailsSection() {
  return (
    <MotionStack gap="lg" border="primary" radius="md" padding="lg" layout="position">
      <Heading as="h2" size="xl">
        {t('Project details')}
      </Heading>
      <Text variant="muted">{t('Project details step content goes here (VDY-76).')}</Text>
    </MotionStack>
  );
}

const MotionStack = motion.create(Stack);
const MotionFlex = motion.create(Flex);
