import {useCallback, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {slugify} from 'sentry/utils/slugify';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import type {ScmAnalyticsFlow} from 'sentry/views/onboarding/components/scmAnalyticsFlow';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  getRequestDataFragment,
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

// The project-details analytics events, routed by the active flow (new-org
// onboarding vs SCM-first project creation). The project_creation.* events are
// registered in projectCreationAnalyticsEvents.tsx. STEP_VIEWED is fired by the
// presentational component when the step is rendered, not here.
const NAME_EDITED_EVENT = {
  onboarding: 'onboarding.scm_project_details_name_edited',
  'project-creation': 'project_creation.scm_project_details_name_edited',
} as const;
const TEAM_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_project_details_team_selected',
  'project-creation': 'project_creation.scm_project_details_team_selected',
} as const;
const ALERT_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_project_details_alert_selected',
  'project-creation': 'project_creation.scm_project_details_alert_selected',
} as const;
const CREATE_CLICKED_EVENT = {
  onboarding: 'onboarding.scm_project_details_create_clicked',
  'project-creation': 'project_creation.scm_project_details_create_clicked',
} as const;
const CREATE_SUCCEEDED_EVENT = {
  onboarding: 'onboarding.scm_project_details_create_succeeded',
  'project-creation': 'project_creation.scm_project_details_create_succeeded',
} as const;
const CREATE_FAILED_EVENT = {
  onboarding: 'onboarding.scm_project_details_create_failed',
  'project-creation': 'project_creation.scm_project_details_create_failed',
} as const;

interface UseScmProjectDetailsOptions {
  analyticsFlow: ScmAnalyticsFlow;
  /** Called after a project is created (or an unchanged one reused). */
  onComplete: () => void;
  onProjectCreated: (slug: string | undefined) => void;
  onProjectDetailsFormChange: (form: ProjectDetailsFormState) => void;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
  /**
   * Mirror classic project creation: when the viewer has no admin team and
   * can't create one, drop the team requirement and create with no team (the
   * backend assigns one). Off by default so onboarding keeps requiring a team.
   */
  allowMemberWithoutTeam?: boolean;
  /** Slug of an already-created project, used for the back-nav reuse check. */
  createdProjectSlug?: string;
  projectDetailsForm?: ProjectDetailsFormState;
}

interface ScmProjectDetailsForm {
  alertRuleConfig: AlertRuleOptions;
  /** Whether the form is complete enough to submit. */
  canSubmit: boolean;
  /** The most recent create error, for hosts that surface it inline. */
  error: RequestError | null;
  /** Whether a create is in flight. */
  isBusy: boolean;
  /** Whether the team selector should be hidden (no-access member). */
  isOrgMemberWithNoAccess: boolean;
  onAlertChange: <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => void;
  onProjectNameBlur: () => void;
  onProjectNameChange: (value: string) => void;
  onTeamChange: (option: {value: string}) => void;
  /** Resolved project name (user edit, falling back to the platform default). */
  projectName: string;
  /** Creates the project (or reuses an unchanged one) and reports completion. */
  submit: () => void;
  /** Resolved team slug (user selection, falling back to first admin team). */
  teamSlug: string;
}

/**
 * Owns the SCM project-details form state, the create-project + repo-link flow,
 * and the field/create analytics (routed by `analyticsFlow`). Returned to the
 * host so it can render the presentational `ScmProjectDetailsCore` form and
 * place its own Create button (onboarding's fixed footer, project creation's
 * page-level footer) independent of where the form fields render.
 */
export function useScmProjectDetails({
  analyticsFlow,
  onComplete,
  onProjectCreated,
  onProjectDetailsFormChange,
  selectedPlatform,
  selectedRepository,
  createdProjectSlug,
  projectDetailsForm,
  allowMemberWithoutTeam,
}: UseScmProjectDetailsOptions): ScmProjectDetailsForm {
  const organization = useOrganization();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();

  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));
  const firstAdminTeam = accessTeams[0];
  // A member with no admin team who also can't create one: with
  // allowMemberWithoutTeam we let them create a project anyway (backend assigns
  // a new team), matching classic project creation.
  const isOrgMemberWithNoAccess =
    !!allowMemberWithoutTeam &&
    accessTeams.length === 0 &&
    !organization.access.includes('project:admin');
  const defaultName = slugify(selectedPlatform?.key ?? '');

  // State tracks user edits. When the host restores a persisted
  // projectDetailsForm (e.g. back-navigation in onboarding) it seeds the inputs.
  const [projectName, setProjectName] = useState(projectDetailsForm?.projectName ?? null);
  const [teamSlug, setTeamSlug] = useState(projectDetailsForm?.teamSlug ?? null);
  const [alertRuleConfig, setAlertRuleConfig] = useState(
    projectDetailsForm?.alertRuleConfig ?? DEFAULT_ISSUE_ALERT_OPTIONS_VALUES
  );

  const projectNameResolved = projectName ?? defaultName;
  const teamSlugResolved = teamSlug ?? firstAdminTeam?.slug ?? '';

  const onProjectNameChange = useCallback((value: string) => {
    setProjectName(slugify(value));
  }, []);

  const onProjectNameBlur = useCallback(() => {
    if (projectName !== null) {
      trackAnalytics(NAME_EDITED_EVENT[analyticsFlow], {
        organization,
        custom: projectName !== defaultName,
      });
    }
  }, [projectName, defaultName, organization, analyticsFlow]);

  const onTeamChange = useCallback(
    ({value}: {value: string}) => {
      setTeamSlug(value);
      trackAnalytics(TEAM_SELECTED_EVENT[analyticsFlow], {organization, team: value});
    },
    [organization, analyticsFlow]
  );

  const onAlertChange = useCallback(
    <K extends keyof AlertRuleOptions>(key: K, value: AlertRuleOptions[K]) => {
      setAlertRuleConfig(prev => ({...prev, [key]: value}));
      if (key === 'alertSetting') {
        const optionMap: Record<number, string> = {
          [RuleAction.DEFAULT_ALERT]: 'high_priority',
          [RuleAction.CUSTOMIZED_ALERTS]: 'custom',
          [RuleAction.CREATE_ALERT_LATER]: 'create_later',
        };
        trackAnalytics(ALERT_SELECTED_EVENT[analyticsFlow], {
          organization,
          option: optionMap[value as number] ?? String(value),
        });
      }
    },
    [organization, analyticsFlow]
  );

  // Block submission until teams and the projects store have loaded so the
  // reuse check below can't be bypassed by a race.
  const canSubmit =
    projectNameResolved.length > 0 &&
    (isOrgMemberWithNoAccess || teamSlugResolved.length > 0) &&
    !!selectedPlatform &&
    !createProjectAndRules.isPending &&
    !isLoadingTeams &&
    projectsLoaded;

  const existingProject = createdProjectSlug
    ? projects.find(p => p.slug === createdProjectSlug)
    : undefined;

  // Platform is compared against the project record rather than a form-state
  // snapshot because the Project model tracks it; alert fields are not on the
  // Project record so we compare those against the context snapshot.
  const samePlatform = existingProject?.platform === selectedPlatform?.key;
  const savedAlert = projectDetailsForm?.alertRuleConfig;
  const nothingChanged =
    samePlatform &&
    !!projectDetailsForm &&
    projectNameResolved === projectDetailsForm.projectName &&
    teamSlugResolved === projectDetailsForm.teamSlug &&
    alertRuleConfig.alertSetting === savedAlert?.alertSetting &&
    alertRuleConfig.interval === savedAlert?.interval &&
    alertRuleConfig.metric === savedAlert?.metric &&
    alertRuleConfig.threshold === savedAlert?.threshold;

  const submit = useCallback(async () => {
    if (!selectedPlatform || !canSubmit) {
      return;
    }

    trackAnalytics(CREATE_CLICKED_EVENT[analyticsFlow], {organization});

    // User navigated back and clicked Create without changing anything; skip
    // to completion without creating a duplicate. Any actual change abandons
    // the previous project and creates a new one, matching legacy onboarding.
    if (existingProject && nothingChanged) {
      trackAnalytics(CREATE_SUCCEEDED_EVENT[analyticsFlow], {
        organization,
        project_slug: existingProject.slug,
      });
      onComplete();
      return;
    }

    try {
      const {project} = await createProjectAndRules.mutateAsync({
        projectName: projectNameResolved,
        platform: selectedPlatform,
        team: isOrgMemberWithNoAccess ? undefined : teamSlugResolved,
        alertRuleConfig: getRequestDataFragment(alertRuleConfig),
        createNotificationAction: () => {},
      });

      // Store the project slug separately so the host can find the project
      // without corrupting selectedPlatform.key.
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

      onProjectDetailsFormChange({
        projectName: projectNameResolved,
        teamSlug: teamSlugResolved,
        alertRuleConfig,
      });

      trackAnalytics(CREATE_SUCCEEDED_EVENT[analyticsFlow], {
        organization,
        project_slug: project.slug,
      });

      onComplete();
    } catch (error) {
      trackAnalytics(CREATE_FAILED_EVENT[analyticsFlow], {organization});
      addErrorMessage(t('Failed to create project'));
      Sentry.captureException(error);
    }
  }, [
    analyticsFlow,
    alertRuleConfig,
    canSubmit,
    createProjectAndRules,
    existingProject,
    isOrgMemberWithNoAccess,
    nothingChanged,
    onComplete,
    onProjectCreated,
    onProjectDetailsFormChange,
    organization,
    projectNameResolved,
    selectedPlatform,
    selectedRepository,
    teamSlugResolved,
  ]);

  return {
    projectName: projectNameResolved,
    onProjectNameChange,
    onProjectNameBlur,
    teamSlug: teamSlugResolved,
    onTeamChange,
    alertRuleConfig,
    onAlertChange,
    isOrgMemberWithNoAccess,
    canSubmit,
    isBusy: createProjectAndRules.isPending,
    error: createProjectAndRules.error,
    submit,
  };
}
