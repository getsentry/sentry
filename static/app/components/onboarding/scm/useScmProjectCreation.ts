import {useCallback, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useQueryClient, type QueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {
  getProjectWorkflowVariables,
  useCreateProjectAndRules,
} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {
  HIGH_PRIORITY_WORKFLOW_NAME,
  useCreateProjectWorkflow,
  type CreatedProjectWorkflow,
} from 'sentry/components/onboarding/useCreateProjectWorkflow';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {fetchIssueStreamDetectorIdsForProjects} from 'sentry/views/automations/utils/fetchIssueStreamDetectorIds';
import type {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import type {NotificationSelection} from 'sentry/views/projectInstall/messagingIntegrationTypes';

import {linkProjectToRepository} from './linkProjectToRepository';
import type {CreatedProject} from './scmMessagingSetup';
import {getScmDefaultProjectName} from './scmProjectName';

type GetIntegrationAction = ReturnType<
  typeof useCreateNotificationAction
>['getIntegrationAction'];

export interface ScmProjectCreationResult {
  /**
   * `created`: a new project. `updated`: the project created earlier in this
   * session was edited to match the submission. `unchanged`: that project
   * already matched, so nothing was written.
   */
  outcome: 'created' | 'updated' | 'unchanged';
  project: Project;
  /** Workflows created by this submission. */
  workflowIds: string[];
  notificationRule?: CreatedProjectWorkflow;
}

interface UseScmProjectCreationOptions {
  /**
   * The project created earlier in this onboarding session, with the
   * messaging destination it was created for. A later submission edits this
   * project instead of creating another, so its DSN never changes.
   * Persisted via onCreatedProjectChange.
   */
  createdProject: CreatedProject | undefined;
  /**
   * Persists the created project (onboarding session state). Called
   * immediately after each project write succeeds and before repository
   * linking or completion, so the duplicate-prevention handoff to SDK setup is
   * never skipped by a later failure.
   */
  onCreatedProjectChange: (createdProject: CreatedProject) => void;
  selectedRepository: Repository | undefined;
}

interface CreateOrReuseProjectOptions {
  /**
   * Runs after creation (or the edit, or reuse) succeeds, while the
   * duplicate-submit guard is still held. Completion must happen inside the
   * guarded window: the projects store and session state update
   * asynchronously, so a second click after the guard released but before the
   * re-render could pass the existing-project check with stale data and
   * create a duplicate.
   */
  onSuccess: (result: ScmProjectCreationResult) => void;
  platform: OnboardingSelectedSDK;
  /**
   * Alert rules to create alongside the project. Defaults to the server-side
   * default (email) rules only.
   */
  alertRuleConfig?: Partial<RequestDataFragment>;
  /**
   * Returns the selected messaging-integration action, if one is configured.
   * Defaults to a no-op (email-only creation).
   */
  getIntegrationAction?: GetIntegrationAction;
  /**
   * The messaging destination this submission would create a workflow for;
   * undefined for an email-only submission (Set up later). Compared against
   * the created project's destination: a different one replaces the
   * project's alert workflow. "Set up later" means "change nothing now", so
   * undefined never touches the created project's workflow.
   */
  stagedSelection?: NotificationSelection;
}

const noopIntegrationAction: GetIntegrationAction = () => {};

/**
 * Shared project + alert-rule creation for the SCM onboarding flow. Both
 * experiment branches call this from their respective creation boundaries:
 * control after platform/features, treatment on the messaging step's final
 * Continue / Set up later.
 *
 * Owns the onboarding-specific concerns around useCreateProjectAndRules:
 * synchronous duplicate-submit protection, editing the session's project
 * after back-navigation instead of creating another, created-project
 * persistence ordering, default team/name resolution, and best-effort
 * repository linking.
 */
export function useScmProjectCreation({
  createdProject,
  onCreatedProjectChange,
  selectedRepository,
}: UseScmProjectCreationOptions) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();
  const {mutateAsync: createProjectWorkflow} = useCreateProjectWorkflow();

  // The ref is the synchronous re-entry guard; the state drives busy/disabled
  // UI. See useScmProjectDetails for the same pattern and rationale.
  const isCreatingRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);

  // Callers must gate submission on this so the existing-project lookup below
  // can't be bypassed by a race while the teams/projects stores load.
  const isDataPending = isLoadingTeams || !projectsLoaded;

  const createOrReuseProject = useCallback(
    async ({
      platform,
      alertRuleConfig,
      getIntegrationAction,
      stagedSelection,
      onSuccess,
    }: CreateOrReuseProjectOptions): Promise<ScmProjectCreationResult | undefined> => {
      if (isCreatingRef.current) {
        return undefined;
      }

      // A project created earlier in this session (the user went back and
      // submitted again) is edited to match this submission instead of being
      // replaced: the user may already have copied its DSN.
      const existingProject = createdProject
        ? projects.find(p => p.slug === createdProject.slug)
        : undefined;
      if (createdProject && existingProject) {
        const platformChanged = existingProject.platform !== platform.key;
        const destinationChanged =
          stagedSelection !== undefined &&
          !isSameSelection(stagedSelection, createdProject.messagingSelection);

        if (!platformChanged && !destinationChanged) {
          const result: ScmProjectCreationResult = {
            outcome: 'unchanged',
            project: existingProject,
            workflowIds: [],
          };
          onSuccess(result);
          return result;
        }

        isCreatingRef.current = true;
        setIsCreating(true);
        // oxlint-disable-next-line react/todo
        try {
          let project = existingProject;
          if (platformChanged) {
            const updated = await updateProjectPlatform({
              api,
              organization,
              project: existingProject,
              platformKey: platform.key,
              selectedRepository,
            }).catch(error => {
              toast.error(t('Failed to update project'));
              Sentry.captureException(error);
              return null;
            });
            if (!updated) {
              return undefined;
            }
            project = updated;
            // The slug can change with the name, so persist it before the
            // workflow requests below.
            onCreatedProjectChange({
              slug: project.slug,
              messagingSelection: createdProject.messagingSelection,
            });
          }

          let workflow: CreatedProjectWorkflow | undefined;
          let notificationRule: CreatedProjectWorkflow | undefined;
          if (destinationChanged) {
            const integrationAction = (getIntegrationAction ?? noopIntegrationAction)({
              shouldCreateRule: alertRuleConfig?.shouldCreateRule,
            });
            // The same workflow a new project gets for this submission: one
            // high-priority workflow with email and the integration action.
            try {
              workflow = await replaceProjectWorkflow({
                api,
                queryClient,
                organization,
                project,
                create: () =>
                  createProjectWorkflow(
                    getProjectWorkflowVariables({
                      project,
                      alertRuleConfig,
                      integrationAction,
                    })
                  ),
              });
            } catch (error) {
              toast.error(t('Failed to update project alerts'));
              Sentry.captureException(error);
              return undefined;
            }
            notificationRule = integrationAction ? workflow : undefined;
            onCreatedProjectChange({
              slug: project.slug,
              messagingSelection: stagedSelection,
            });
          }

          trackAnalytics('onboarding.scm_project_updated', {
            organization,
            platform: platform.key,
            project_id: project.id,
            platform_changed: platformChanged,
            notification_changed: destinationChanged,
          });

          const result: ScmProjectCreationResult = {
            outcome: 'updated',
            project,
            workflowIds: workflow ? [workflow.id] : [],
            notificationRule,
          };
          onSuccess(result);
          return result;
        } finally {
          isCreatingRef.current = false;
          setIsCreating(false);
        }
      }

      const firstAdminTeam = teams.find((team: Team) =>
        team.access.includes('team:admin')
      );

      isCreatingRef.current = true;
      setIsCreating(true);
      // oxlint-disable-next-line react/todo
      try {
        const creation = await createProjectAndRules
          .mutateAsync({
            projectName: getScmDefaultProjectName({
              repository: selectedRepository,
              platformKey: platform.key,
            }),
            platform,
            team: firstAdminTeam?.slug,
            alertRuleConfig: alertRuleConfig ?? {defaultRules: true},
            getIntegrationAction: getIntegrationAction ?? noopIntegrationAction,
          })
          .catch(error => {
            toast.error(t('Failed to create project'));
            Sentry.captureException(error);
            return null;
          });
        if (!creation) {
          return undefined;
        }

        // Slug and destination in one update, before the linking await below:
        // a reload during linking restores both together, so the
        // existing-project check can never see a slug without its destination.
        onCreatedProjectChange({
          slug: creation.project.slug,
          messagingSelection: stagedSelection,
        });

        // Recorded before the best-effort repository link: the project and its
        // rules exist at this point whatever linking does.
        trackAnalytics('onboarding.scm_project_created', {
          organization,
          platform: platform.key,
          project_id: creation.project.id,
          notification: creation.notificationRule ? 'integration' : 'email_only',
        });

        if (selectedRepository?.id) {
          await linkProjectToRepository({
            orgSlug: organization.slug,
            projectSlug: creation.project.slug,
            repositoryId: selectedRepository.id,
          });
        }

        const result: ScmProjectCreationResult = {
          outcome: 'created',
          project: creation.project,
          workflowIds: creation.workflowIds,
          notificationRule: creation.notificationRule,
        };
        onSuccess(result);
        return result;
      } finally {
        isCreatingRef.current = false;
        setIsCreating(false);
      }
    },
    [
      // oxlint-disable-next-line react/memo-dependencies
      api,
      createProjectAndRules,
      createProjectWorkflow,
      createdProject,
      onCreatedProjectChange,
      organization,
      projects,
      queryClient,
      selectedRepository,
      teams,
    ]
  );

  return {createOrReuseProject, isCreating, isDataPending};
}

/**
 * Sets the project's platform. A name onboarding derived from the old
 * platform is renamed for the new one; a name from the repository, or one the
 * backend deduplicated, is kept. The rename is dropped if it fails (e.g. the
 * slug is taken), since the platform is what the setup docs depend on.
 */
async function updateProjectPlatform({
  api,
  organization,
  project,
  platformKey,
  selectedRepository,
}: {
  api: Client;
  organization: Organization;
  platformKey: OnboardingSelectedSDK['key'];
  project: Project;
  selectedRepository: Repository | undefined;
}): Promise<Project> {
  const url = getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
    path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
  });
  const oldDefaultName = getScmDefaultProjectName({
    repository: selectedRepository,
    platformKey: project.platform,
  });
  const newDefaultName = getScmDefaultProjectName({
    repository: selectedRepository,
    platformKey,
  });
  const shouldRename =
    project.name === oldDefaultName && newDefaultName !== oldDefaultName;

  let updated: Project | undefined;
  if (shouldRename) {
    updated = await api
      .requestPromise(url, {
        method: 'PUT',
        data: {platform: platformKey, name: newDefaultName, slug: newDefaultName},
      })
      .catch(() => {});
  }
  updated ??= (await api.requestPromise(url, {
    method: 'PUT',
    data: {platform: platformKey},
  })) as Project;

  ProjectsStore.onUpdateSuccess(updated);
  return updated;
}

/**
 * Swaps the project's onboarding alert workflow for a new one. Onboarding
 * gives a project one high-priority workflow (server default or created
 * alongside it); it is matched by that name and by being attached to only
 * this project, so an org-wide or hand-made workflow is never removed. The
 * new workflow is created before the old one is deleted, so a failure never
 * leaves the project without alerts. A failed delete only logs: the project
 * then has both workflows, which costs a duplicate notification, not data.
 */
async function replaceProjectWorkflow({
  api,
  queryClient,
  organization,
  project,
  create,
}: {
  api: Client;
  create: () => Promise<CreatedProjectWorkflow>;
  organization: Organization;
  project: Project;
  queryClient: QueryClient;
}): Promise<CreatedProjectWorkflow> {
  const [detectorId] = await fetchIssueStreamDetectorIdsForProjects({
    queryClient,
    organization,
    projectIds: [project.id],
  });
  const {json: workflows} = await queryClient.fetchQuery(
    automationsApiOptions(organization, {projects: [Number(project.id)]})
  );
  const oldWorkflowIds = workflows
    .filter(
      workflow =>
        workflow.name === HIGH_PRIORITY_WORKFLOW_NAME &&
        detectorId !== undefined &&
        workflow.detectorIds.length === 1 &&
        workflow.detectorIds[0] === detectorId
    )
    .map(workflow => workflow.id);

  const workflow = await create();

  await Promise.all(
    oldWorkflowIds.map(workflowId =>
      api
        .requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
            path: {organizationIdOrSlug: organization.slug, workflowId},
          }),
          {method: 'DELETE'}
        )
        .catch(error => Sentry.captureException(error))
    )
  );
  queryClient.invalidateQueries({queryKey: automationsApiOptions(organization).queryKey});

  return workflow;
}

function isSameSelection(
  staged: NotificationSelection,
  saved: NotificationSelection | undefined
) {
  if (!saved) {
    return false;
  }
  return (
    staged.provider === saved.provider &&
    staged.integrationId === saved.integrationId &&
    staged.channel === saved.channel
  );
}
