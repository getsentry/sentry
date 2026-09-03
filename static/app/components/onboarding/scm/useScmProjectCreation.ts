import {useCallback, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {linkProjectToRepository} from 'sentry/components/onboarding/scm/linkProjectToRepository';
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
import type {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

type GetIntegrationAction = ReturnType<
  typeof useCreateNotificationAction
>['getIntegrationAction'];

export interface ScmProjectCreationResult {
  project: Project;
  /**
   * True when an already-created project was reused (back-nav with an
   * unchanged platform) instead of creating a new one.
   */
  reused: boolean;
  workflowIds: string[];
  notificationRule?: CreatedProjectRule;
}

interface UseScmProjectCreationOptions {
  /**
   * Slug of a project created earlier in this onboarding session, used for the
   * reuse-on-back check. Persisted via onProjectCreated.
   */
  createdProjectSlug: string | undefined;
  /**
   * Persists the created project slug (onboarding session state). Called
   * immediately after the project POST succeeds and before repository linking
   * or completion, so the duplicate-prevention handoff to SDK setup is never
   * skipped by a later failure.
   */
  onProjectCreated: (slug: string) => void;
  selectedRepository: Repository | undefined;
}

interface CreateOrReuseProjectOptions {
  /**
   * Runs after creation (or reuse) succeeds, while the duplicate-submit guard
   * is still held. Completion must happen inside the guarded window: the
   * projects store and session slug update asynchronously, so a second click
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
 * back-navigation, slug persistence ordering, default team/name resolution,
 * and best-effort repository linking.
 */
export function useScmProjectCreation({
  createdProjectSlug,
  onProjectCreated,
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
      onSuccess,
    }: CreateOrReuseProjectOptions): Promise<ScmProjectCreationResult | undefined> => {
      if (isCreatingRef.current) {
        return undefined;
      }

      // If a project was already created for this platform (e.g. the user
      // went back after the project received its first event), reuse it.
      // If the platform changed, abandon the old project and create a new
      // one — matching legacy onboarding behavior.
      const existingProject = createdProjectSlug
        ? projects.find(p => p.slug === createdProjectSlug)
        : undefined;
      if (existingProject?.platform === platform.key) {
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

        onProjectCreated(creation.project.slug);

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
      createdProjectSlug,
      onProjectCreated,
      organization.slug,
      projects,
      selectedRepository,
      teams,
    ]
  );

  return {createOrReuseProject, isCreating, isDataPending};
}
