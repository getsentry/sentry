import {Fragment, useCallback} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import type {Repository} from 'sentry/types/integrationsBase';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {ScmIntegrationConnect} from 'sentry/views/onboarding/components/scmIntegrationConnect';
import {useScmProviders} from 'sentry/views/onboarding/components/useScmProviders';

const CREATE_PROJECT_MAX_WIDTH = '760px';

interface WizardState {
  // Flips true on the first meaningful action in section 1 (repo selected
  // or "Continue without connecting a repo" clicked). Sections 2 and 3
  // reveal together when this is true. Decoupled from selection state so
  // later state edits (de-selecting a repo) do not collapse the rest of
  // the page.
  repoStepCompleted: boolean;
  selectedIntegration: Integration | undefined;
  selectedRepository: Repository | undefined;
}

const INITIAL_STATE: WizardState = {
  repoStepCompleted: false,
  selectedIntegration: undefined,
  selectedRepository: undefined,
};

export function ScmCreateProject() {
  // Session-storage backed so a refresh restores how far the user has
  // progressed. Separate key from new-org onboarding's 'onboarding' key.
  const [{repoStepCompleted, selectedIntegration, selectedRepository}, setState] =
    useSessionStorage('project-creation-wizard', INITIAL_STATE);
  const canUserCreateProject = useCanCreateProject();
  // Subscribe so the parent re-renders when integration state changes inside
  // ScmIntegrationConnect, letting framer-motion's layout="position" siblings
  // below re-measure and animate position shifts. React Query dedupes with
  // the child's call.
  useScmProviders();

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

  // No-op until sections 2 and 3 wire up their own state. VDY-75/76 will
  // replace this with platform/features/project clearing.
  const handleClearDerivedState = useCallback(() => {}, []);

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
                <PlatformFeaturesSection />
                <ProjectDetailsSection />
              </Fragment>
            )}
          </LayoutGroup>
        </Stack>
      </Access>
    </SentryDocumentTitle>
  );
}

// Placeholder for VDY-75. Will be replaced with <ScmPlatformFeatures />.
function PlatformFeaturesSection() {
  return (
    <MotionStack layout="position" gap="lg" border="primary" radius="md" padding="lg">
      <Heading as="h2" size="xl">
        {t('Platform & features')}
      </Heading>
      <Text variant="muted">
        {t('Platform and features step content goes here (VDY-75).')}
      </Text>
    </MotionStack>
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
