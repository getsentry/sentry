import {Fragment, useCallback, useState} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {ProjectCreationErrorAlert} from 'sentry/components/onboarding/projectCreationErrorAlert';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {decodeScalar} from 'sentry/utils/queryString';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage, writeStorageValue} from 'sentry/utils/useSessionStorage';
import {ScmIntegrationConnect} from 'sentry/views/onboarding/components/scmIntegrationConnect';
import {ScmPlatformFeaturesCore} from 'sentry/views/onboarding/components/scmPlatformFeaturesCore';
import {ScmProjectDetailsCore} from 'sentry/views/onboarding/components/scmProjectDetailsCore';
import {useScmPlatformDetection} from 'sentry/views/onboarding/components/useScmPlatformDetection';
import {
  type ScmProjectDetailsCompletion,
  useScmProjectDetails,
} from 'sentry/views/onboarding/components/useScmProjectDetails';
import {useScmProviders} from 'sentry/views/onboarding/components/useScmProviders';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

const CREATE_PROJECT_MAX_WIDTH = '760px';
const WIZARD_STORAGE_KEY = 'project-creation-wizard';

interface WizardState {
  // Id/slug of the project created in this wizard session. The id validates a
  // return from getting-started (see the entry resolution in ScmCreateProject);
  // the slug drives the getting-started navigation and the project-details
  // reuse check.
  createdProjectId: string | undefined;
  createdProjectSlug: string | undefined;
  projectDetailsForm: ProjectDetailsFormState | undefined;
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
  createdProjectId: undefined,
  createdProjectSlug: undefined,
  projectDetailsForm: undefined,
  selectedFeatures: undefined,
  selectedIntegration: undefined,
  selectedPlatform: undefined,
  selectedRepository: undefined,
};

export function ScmCreateProject() {
  const location = useLocation();
  const referrer = decodeScalar(location.query.referrer);
  const projectId = decodeScalar(location.query.project);

  // Snapshot of the last completed wizard session, written when a project is
  // created (see handleComplete in the wizard). Restored when this mount is a
  // return from that project's getting-started page, whose back nav tags the
  // URL with referrer + project id (mirrors createProject's autofill
  // condition). Computed reactively rather than once at mount because the tag
  // can arrive late: deleting an inactive project redirects here bare before
  // the back nav's replace navigation appends the query params (browser-back
  // POPs race the same way).
  const [savedSession] = useSessionStorage<WizardState | null>(WIZARD_STORAGE_KEY, null);
  const isReturnFromGettingStarted =
    referrer === 'getting-started' &&
    !!savedSession?.createdProjectId &&
    projectId === savedSession.createdProjectId;
  const restoredSession = isReturnFromGettingStarted ? savedSession : null;

  // Keyed so a restore arriving after mount remounts the wizard and
  // mount-seeded form state re-reads the restored session.
  return (
    <ScmCreateProjectWizard
      key={restoredSession ? 'restored' : 'fresh'}
      initialState={restoredSession ?? INITIAL_STATE}
    />
  );
}

function ScmCreateProjectWizard({initialState}: {initialState: WizardState}) {
  const organization = useOrganization();
  const navigate = useNavigate();

  // In-memory while in progress, so a fresh visit or reload starts clean; the
  // session is only persisted once a project is created.
  const [wizardState, setState] = useState(initialState);
  const {
    repoStepCompleted,
    createdProjectSlug,
    projectDetailsForm,
    selectedFeatures,
    selectedIntegration,
    selectedPlatform,
    selectedRepository,
  } = wizardState;

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

  // Clear state derived from the repository when the repo changes. Platform,
  // features, and the project-details form are repo-dependent (auto-detection
  // seeds the platform, which in turn seeds the project name).
  const handleClearDerivedState = useCallback(() => {
    setState(s => ({
      ...s,
      selectedPlatform: undefined,
      selectedFeatures: undefined,
      projectDetailsForm: undefined,
    }));
  }, [setState]);

  // Clear the project-details form when the platform changes, since the
  // project name defaults from the platform key; the hook re-derives cleared
  // fields.
  const handleClearProjectDetailsForm = useCallback(() => {
    setState(s => ({...s, projectDetailsForm: undefined}));
  }, [setState]);

  const handleProjectDetailsFormChange = useCallback(
    (projectDetailsFormState: ProjectDetailsFormState) => {
      setState(s => ({...s, projectDetailsForm: projectDetailsFormState}));
    },
    [setState]
  );

  // Snapshot the completed session (the created project's id validates the
  // return from getting-started, the slug feeds the reuse check, and the form
  // seeds the fields) so it can be restored later (see ScmCreateProject), then
  // leave for the project's getting-started page. Live wizard state never
  // holds the created project, so there is nothing to commit before unmount.
  const handleComplete = useCallback(
    ({project, projectDetailsForm: submittedForm}: ScmProjectDetailsCompletion) => {
      writeStorageValue(WIZARD_STORAGE_KEY, {
        ...wizardState,
        createdProjectId: project.id,
        createdProjectSlug: project.slug,
        projectDetailsForm: submittedForm,
      });
      navigate(
        makeProjectsPathname({
          path: `/${project.slug}/getting-started/`,
          organization,
        })
      );
    },
    [wizardState, navigate, organization]
  );

  const form = useScmProjectDetails({
    analyticsFlow: 'project-creation',
    allowMemberWithoutTeam: true,
    selectedPlatform,
    selectedRepository,
    createdProjectSlug,
    projectDetailsForm,
    onProjectDetailsFormChange: handleProjectDetailsFormChange,
    onComplete: handleComplete,
  });

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

                <MotionStack
                  layout="position"
                  gap="lg"
                  border="primary"
                  radius="md"
                  padding="lg"
                >
                  <Stack gap="md">
                    <Heading as="h2" size="xl">
                      {t('Project details')}
                    </Heading>
                    <Text variant="muted">
                      {t('Name your project, assign a team, and set up issue alerts.')}
                    </Text>
                  </Stack>
                  <ScmProjectDetailsCore
                    analyticsFlow="project-creation"
                    projectName={form.projectName}
                    onProjectNameChange={form.onProjectNameChange}
                    onProjectNameBlur={form.onProjectNameBlur}
                    teamSlug={form.teamSlug}
                    onTeamChange={form.onTeamChange}
                    alertRuleConfig={form.alertRuleConfig}
                    onAlertChange={form.onAlertChange}
                    isOrgMemberWithNoAccess={form.isOrgMemberWithNoAccess}
                  />
                </MotionStack>
              </Fragment>
            )}
          </LayoutGroup>

          {/* Page-level CTA: always present so the primary action is available
              regardless of which steps are currently revealed. Disabled until a
              platform and project details are ready. */}
          <Stack gap="md">
            <ProjectCreationErrorAlert error={form.error} />
            <Flex justify="end">
              <Button
                variant="primary"
                onClick={form.submit}
                disabled={!form.canSubmit}
                busy={form.isBusy}
                icon={<IconProject />}
              >
                {t('Create project')}
              </Button>
            </Flex>
          </Stack>
        </Stack>
      </Access>
    </SentryDocumentTitle>
  );
}

const MotionStack = motion.create(Stack);
const MotionFlex = motion.create(Flex);
