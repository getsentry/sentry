import {useCallback, useState} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Access} from 'sentry/components/acl/access';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {ProjectCreationErrorAlert} from 'sentry/components/onboarding/projectCreationErrorAlert';
import {ScmAlertFrequencySection} from 'sentry/components/onboarding/scm/scmAlertFrequencySection';
import {ScmFeatureSelectionPanel} from 'sentry/components/onboarding/scm/scmFeatureSelectionPanel';
import {ScmIntegrationConnect} from 'sentry/components/onboarding/scm/scmIntegrationConnect';
import {ScmPlatformFeaturesCore} from 'sentry/components/onboarding/scm/scmPlatformFeaturesCore';
import {ScmProjectDetailsCore} from 'sentry/components/onboarding/scm/scmProjectDetailsCore';
import {useScmPlatformDetection} from 'sentry/components/onboarding/scm/useScmPlatformDetection';
import {
  type ScmProjectDetailsCompletion,
  useScmProjectDetails,
} from 'sentry/components/onboarding/scm/useScmProjectDetails';
import {useScmProviders} from 'sentry/components/onboarding/scm/useScmProviders';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {decodeScalar} from 'sentry/utils/queryString';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage, writeStorageValue} from 'sentry/utils/useSessionStorage';
import {
  WIZARD_STORAGE_KEY,
  type WizardState,
} from 'sentry/views/projectInstall/scmCreateProjectSession';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

const CREATE_PROJECT_MAX_WIDTH = '700px';

const INITIAL_STATE: WizardState = {
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

  // Single page-viewed event for the whole flow. Unlike onboarding's discrete
  // steps, every section renders at once here, so the per-section step_viewed
  // events the shared cores fire in onboarding are intentionally suppressed in
  // this flow. Reuses the classic project_creation_page.viewed counter (shared
  // with the legacy CreateProject flow) and carries variant:'scm' so the SCM
  // funnel stays separable without splitting the absolute page-view count.
  useRouteAnalyticsEventNames(
    'project_creation_page.viewed',
    'Project Create: Creation page viewed'
  );
  useRouteAnalyticsParams({variant: 'scm'});

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

  const handleIntegrationChange = useCallback(
    (integration: Integration | undefined) => {
      setState(s => ({...s, selectedIntegration: integration}));
    },
    [setState]
  );

  const handleRepositoryChange = useCallback(
    (repository: Repository | undefined) => {
      setState(s => ({...s, selectedRepository: repository}));
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
        // An optimistic repo (empty id, see useScmRepoSelection) can never
        // fetch detection; restoring one would strand the platform section in
        // a permanent spinner, so it is not worth persisting.
        selectedRepository: wizardState.selectedRepository?.id
          ? wizardState.selectedRepository
          : undefined,
        createdProjectId: project.id,
        createdProjectSlug: project.slug,
        projectDetailsForm: submittedForm,
      });
      navigate({
        pathname: makeProjectsPathname({
          path: `/${project.slug}/getting-started/`,
          organization,
        }),
        // Carry both the creating flow and upfront product selection into the
        // setup-docs and getting-started analytics to the SCM variant; the
        // product query seeds the selected instructions.
        query: {
          projectCreationVariant: 'scm',
          ...(wizardState.selectedFeatures
            ? {product: wizardState.selectedFeatures}
            : {}),
        },
      });
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

  const submitTooltipText = form.submitTooltipText;

  return (
    <SentryDocumentTitle title={t('Create a new project')}>
      <Access access={canUserCreateProject ? ['project:read'] : ['project:admin']}>
        <Stack padding="3xl" gap="2xl" align="center">
          <LayoutGroup>
            <MotionStack
              flexGrow={1}
              gap="2xl"
              padding="2xl"
              maxWidth={CREATE_PROJECT_MAX_WIDTH}
              width="100%"
              border="primary"
              radius="lg"
              layout
            >
              <Layout.Title>{t('Create a new project')}</Layout.Title>

              <MotionStack gap="md" layout="position">
                <Heading as="h1">{t('Create a project')}</Heading>
                <Text variant="secondary" density="comfortable">
                  {tct(
                    'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from. [link: Read the docs].',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/" />
                      ),
                    }
                  )}
                </Text>
              </MotionStack>

              <MotionStack gap="md" layout="position">
                <Flex justify="between" align="center">
                  <Stack gap="sm">
                    <Heading as="h4">{t('Repository')}</Heading>
                    <Text variant="secondary" density="comfortable" size="sm">
                      {t(
                        'Source context in stack traces, suspect commits, and deploy tracking'
                      )}
                    </Text>
                  </Stack>
                  <Tag variant="muted">{t('Optional')}</Tag>
                </Flex>

                <ScmIntegrationConnect
                  analyticsFlow="project-creation"
                  allowIntegrationSwitching
                  selectedIntegration={selectedIntegration}
                  selectedRepository={selectedRepository}
                  onIntegrationChange={handleIntegrationChange}
                  onRepositoryChange={handleRepositoryChange}
                  onClearDerivedState={handleClearDerivedState}
                  maxWidth={CREATE_PROJECT_MAX_WIDTH}
                />
              </MotionStack>

              <motion.div layout="position">
                <ScmPlatformFeaturesCore
                  analyticsFlow="project-creation"
                  selectedRepository={selectedRepository}
                  selectedPlatform={selectedPlatform}
                  onPlatformChange={handlePlatformChange}
                  onFeaturesChange={handleFeaturesChange}
                  onClearProjectDetailsForm={handleClearProjectDetailsForm}
                />
              </motion.div>

              <motion.div layout="position">
                <Separator orientation="horizontal" />
              </motion.div>

              <ScmFeatureSelectionPanel
                analyticsFlow="project-creation"
                selectedRepository={selectedRepository}
                selectedPlatform={selectedPlatform}
                selectedFeatures={selectedFeatures}
                onFeaturesChange={handleFeaturesChange}
                trailing={
                  <motion.div layout="position">
                    <Separator orientation="horizontal" />
                  </motion.div>
                }
              />

              <motion.div layout="position">
                <ScmProjectDetailsCore
                  analyticsFlow="project-creation"
                  projectName={form.projectName}
                  onProjectNameChange={form.onProjectNameChange}
                  onProjectNameBlur={form.onProjectNameBlur}
                  teamSlug={form.teamSlug}
                  onTeamChange={form.onTeamChange}
                  isOrgMemberWithNoAccess={form.isOrgMemberWithNoAccess}
                />
              </motion.div>

              <motion.div layout="position">
                <Separator orientation="horizontal" />
              </motion.div>

              <motion.div layout="position">
                <ScmAlertFrequencySection
                  analyticsFlow="project-creation"
                  alertRuleConfig={form.alertRuleConfig}
                  notificationProps={form.notificationProps}
                  onAlertChange={form.onAlertChange}
                />
              </motion.div>
            </MotionStack>
            {/* Page-level CTA: disabled until a platform and project details are
              ready. */}
            <MotionStack
              gap="md"
              maxWidth={CREATE_PROJECT_MAX_WIDTH}
              width="100%"
              layout="position"
            >
              <ProjectCreationErrorAlert error={form.error} />
              <Flex justify="end">
                <Tooltip title={submitTooltipText} disabled={!submitTooltipText}>
                  <Button
                    variant="primary"
                    onClick={form.submit}
                    disabled={!form.canSubmit}
                    busy={form.isBusy}
                    icon={<IconProject />}
                  >
                    {t('Create project')}
                  </Button>
                </Tooltip>
              </Flex>
            </MotionStack>
          </LayoutGroup>
        </Stack>
      </Access>
    </SentryDocumentTitle>
  );
}

const MotionStack = motion.create(Stack);
