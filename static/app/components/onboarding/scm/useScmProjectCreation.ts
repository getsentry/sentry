import {useCallback, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {linkProjectToRepository} from 'sentry/components/onboarding/scm/linkProjectToRepository';
import type {CreatedProject} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import type {CreatedProjectRule} from 'sentry/components/onboarding/useCreateProjectRules';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import type {
  NotificationSelection,
  useCreateNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

type GetIntegrationAction = ReturnType<
  typeof useCreateNotificationAction
>['getIntegrationAction'];

export interface ScmProjectCreationResult {
  project: Project;
  /**
   * True when an already-created project was reused (back-nav with an
   * unchanged platform and destination) instead of creating a new one.
   */
  reused: boolean;
  workflowIds: string[];
  notificationRule?: CreatedProjectRule;
}

interface UseScmProjectCreationOptions {
  /**
   * The project created earlier in this onboarding session, with the
   * messaging destination it was created for. Drives the reuse-on-back check.
   * Persisted via onCreatedProjectChange.
   */
  createdProject: CreatedProject | undefined;
  /**
   * Persists the created project (onboarding session state). Called
   * immediately after the project POST succeeds and before repository linking
   * or completion, so the duplicate-prevention handoff to SDK setup is never
   * skipped by a later failure.
   */
  onCreatedProjectChange: (createdProject: CreatedProject) => void;
  selectedRepository: Repository | undefined;
}

interface CreateOrReuseProjectOptions {
  /**
   * Runs after creation (or reuse) succeeds, while the duplicate-submit guard
   * is still held. Completion must happen inside the guarded window: the
   * projects store and session state update asynchronously, so a second click
   * after the guard released but before the re-render could pass the reuse
   * check with stale data and create a duplicate.
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
   * the created project's destination on reuse: "Set up later" means "change
   * nothing now", so undefined never abandons a created project.
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
 * synchronous duplicate-submit protection, reuse of an unchanged project on
 * back-navigation, created-project persistence ordering, default team/name
 * resolution, and best-effort repository linking.
 */
export function useScmProjectCreation({
  createdProject,
  onCreatedProjectChange,
  selectedRepository,
}: UseScmProjectCreationOptions) {
  const organization = useOrganization();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();

  // The ref is the synchronous re-entry guard; the state drives busy/disabled
  // UI. See useScmProjectDetails for the same pattern and rationale.
  const isCreatingRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);

  // Callers must gate submission on this so the reuse check below can't be
  // bypassed by a race while the teams/projects stores load.
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

      // Reuse the project created earlier in this session (e.g. the user went
      // back after it received its first event) when nothing that shaped it
      // changed: the same platform and, for a submission that stages a
      // destination, the same destination it was created for. Any other
      // change abandons the old project and creates a new one, matching the
      // unchanged-return check in useScmProjectDetails.
      const existingProject = createdProject
        ? projects.find(p => p.slug === createdProject.slug)
        : undefined;
      if (
        createdProject &&
        existingProject?.platform === platform.key &&
        (stagedSelection === undefined ||
          isSameSelection(stagedSelection, createdProject.messagingSelection))
      ) {
        const result: ScmProjectCreationResult = {
          project: existingProject,
          reused: true,
          workflowIds: [],
        };
        onSuccess(result);
        return result;
      }

      const firstAdminTeam = teams.find((team: Team) =>
        team.access.includes('team:admin')
      );

      isCreatingRef.current = true;
      setIsCreating(true);
      try {
        const creation = await createProjectAndRules
          .mutateAsync({
            projectName: platform.key,
            platform,
            team: firstAdminTeam?.slug,
            alertRuleConfig: alertRuleConfig ?? {defaultRules: true},
            getIntegrationAction: getIntegrationAction ?? noopIntegrationAction,
          })
          .catch(error => {
            addErrorMessage(t('Failed to create project'));
            Sentry.captureException(error);
            return null;
          });
        if (!creation) {
          return undefined;
        }

        // Slug and destination in one update, before the linking await below:
        // a reload during linking restores both together, so the reuse check
        // can never see a slug without its destination.
        onCreatedProjectChange({
          slug: creation.project.slug,
          messagingSelection: stagedSelection,
        });

        if (selectedRepository?.id) {
          await linkProjectToRepository({
            orgSlug: organization.slug,
            projectSlug: creation.project.slug,
            repositoryId: selectedRepository.id,
          });
        }

        const result: ScmProjectCreationResult = {
          project: creation.project,
          reused: false,
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
      createProjectAndRules,
      createdProject,
      onCreatedProjectChange,
      organization.slug,
      projects,
      selectedRepository,
      teams,
    ]
  );

  return {createOrReuseProject, isCreating, isDataPending};
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
