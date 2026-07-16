import {useCallback, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import type {ScmAnalyticsFlow} from 'sentry/components/onboarding/scm/scmAnalyticsFlow';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {slugify} from 'sentry/utils/slugify';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {
  buildIntegrationAction,
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useCreateNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
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

export function getSubmitTooltipText({
  platform,
  projectName,
  team,
  notificationChannel,
}: {
  notificationChannel: boolean;
  platform: boolean;
  projectName: boolean;
  team: boolean;
}): string | undefined {
  const missingCount = [platform, projectName, team, notificationChannel].filter(
    Boolean
  ).length;
  if (missingCount > 1) {
    return t('Please fill out all the required fields');
  }
  if (platform) {
    return t('Please select a platform');
  }
  if (projectName) {
    return t('Please provide a project name');
  }
  if (team) {
    return t('Please select a team');
  }
  if (notificationChannel) {
    return t('Please provide an integration channel for alert notifications');
  }
  return undefined;
}

export interface ScmProjectDetailsCompletion {
  /** The created project, or the reused one on the unchanged back-nav path. */
  project: Project;
  /** The form state the project was created with. */
  projectDetailsForm: ProjectDetailsFormState;
}

interface UseScmProjectDetailsOptions {
  analyticsFlow: ScmAnalyticsFlow;
  /**
   * Called once the step is done: a project was created (or an unchanged one
   * reused on the back-nav path) and the repo link attempted. Receives the
   * project and the submitted form state together so the host can persist
   * both and advance in one place.
   */
  onComplete: (completion: ScmProjectDetailsCompletion) => void;
  /**
   * Live form state, owned by the host. Fields absent from the form derive
   * their defaults (platform-based name, first admin team, default alert
   * config), so the host clearing the form makes the fields re-derive.
   */
  onProjectDetailsFormChange: (form: ProjectDetailsFormState) => void;
  projectDetailsForm: ProjectDetailsFormState | undefined;
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
  /** Required fields still missing, for disabled-submit messaging. */
  missingFields: {
    notificationChannel: boolean;
    platform: boolean;
    projectName: boolean;
    team: boolean;
  };
  /** Messaging-integration notification picker props for the alert section. */
  notificationProps: IssueAlertNotificationProps;
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
  /** Tooltip copy for the disabled submit button, or undefined when submittable. */
  submitTooltipText: string | undefined;
  /** Resolved team slug (user selection, falling back to first admin team). */
  teamSlug: string;
}

/**
 * Drives the SCM project-details form (state owned by the host via
 * `projectDetailsForm`/`onProjectDetailsFormChange`), the create-project +
 * repo-link flow, and the field/create analytics (routed by `analyticsFlow`).
 * Returned to the host so it can render the presentational
 * `ScmProjectDetailsCore` form and place its own Create button (onboarding's
 * fixed footer, project creation's page-level footer) independent of where
 * the form fields render.
 */
export function useScmProjectDetails({
  analyticsFlow,
  onComplete,
  onProjectDetailsFormChange,
  projectDetailsForm,
  selectedPlatform,
  selectedRepository,
  createdProjectSlug,
  allowMemberWithoutTeam,
}: UseScmProjectDetailsOptions): ScmProjectDetailsForm {
  const organization = useOrganization();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();

  const restoredNotificationOptionsRef = useRef(
    projectDetailsForm?.notificationAction
      ? {actions: [projectDetailsForm.notificationAction]}
      : undefined
  );

  // Provides the messaging-integration notification picker (notificationProps,
  // rendered in ScmAlertFrequencySection) and the side-effect that creates the
  // chosen notification rule at project creation.
  const {createNotificationAction, notificationProps} = useCreateNotificationAction(
    restoredNotificationOptionsRef.current
  );

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

  // Fields absent from the host-owned form fall back to derived defaults, so
  // a host clearing the form (e.g. on a platform change) re-derives them.
  const projectNameResolved = projectDetailsForm?.projectName ?? defaultName;
  const teamSlugResolved = projectDetailsForm?.teamSlug ?? firstAdminTeam?.slug ?? '';
  const alertRuleConfig =
    projectDetailsForm?.alertRuleConfig ?? DEFAULT_ISSUE_ALERT_OPTIONS_VALUES;

  // Baseline for the unchanged-return (reuse) check below: the form as it was
  // when this step mounted, i.e. a restored session's saved values. Live edits
  // flow through the controlled form, so the prop can't be its own baseline.
  const savedFormRef = useRef(projectDetailsForm);

  const onProjectNameChange = useCallback(
    (value: string) => {
      onProjectDetailsFormChange({...projectDetailsForm, projectName: slugify(value)});
    },
    [onProjectDetailsFormChange, projectDetailsForm]
  );

  const onProjectNameBlur = useCallback(() => {
    if (projectDetailsForm?.projectName !== undefined) {
      trackAnalytics(NAME_EDITED_EVENT[analyticsFlow], {
        organization,
        custom: projectDetailsForm.projectName !== defaultName,
      });
    }
  }, [projectDetailsForm?.projectName, defaultName, organization, analyticsFlow]);

  const onTeamChange = useCallback(
    ({value}: {value: string}) => {
      onProjectDetailsFormChange({...projectDetailsForm, teamSlug: value});
      trackAnalytics(TEAM_SELECTED_EVENT[analyticsFlow], {organization, team: value});
    },
    [onProjectDetailsFormChange, projectDetailsForm, organization, analyticsFlow]
  );

  const onAlertChange = useCallback(
    <K extends keyof AlertRuleOptions>(key: K, value: AlertRuleOptions[K]) => {
      onProjectDetailsFormChange({
        ...projectDetailsForm,
        alertRuleConfig: {...alertRuleConfig, [key]: value},
      });
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
    [
      onProjectDetailsFormChange,
      projectDetailsForm,
      alertRuleConfig,
      organization,
      analyticsFlow,
    ]
  );

  // When notifying via a messaging integration, a channel must be picked before
  // the project can be created. Mirrors the classic flow's active gate (its
  // useValidateChannel is wired with enabled:false, so live validation is off
  // there too; this is the real check). Irrelevant when alerts are turned off.
  const isMissingNotificationChannel =
    alertRuleConfig.alertSetting !== RuleAction.CREATE_ALERT_LATER &&
    notificationProps.actions.includes(MultipleCheckboxOptions.INTEGRATION) &&
    !notificationProps.channel;

  // Ignore a lingering INTEGRATION selection when alerts are off: the picker is
  // hidden, so persisting the action would wrongly force the restore gate later.
  const hasNotificationAction =
    alertRuleConfig.alertSetting !== RuleAction.CREATE_ALERT_LATER &&
    notificationProps.actions.includes(MultipleCheckboxOptions.INTEGRATION);

  const missingFields = {
    notificationChannel: isMissingNotificationChannel,
    platform: !selectedPlatform,
    projectName: projectNameResolved.length === 0,
    // While teams load, teamSlugResolved is empty only because firstAdminTeam
    // isn't available yet, not because the user must pick one. Don't report it
    // as missing so the disabled-CTA tooltip stays silent for this transient
    // blocker (canSubmit gates on !isLoadingTeams independently).
    team: !isOrgMemberWithNoAccess && !isLoadingTeams && teamSlugResolved.length === 0,
  };

  // Tracks the create -> repo-link -> onComplete handoff as one busy span.
  // createProjectAndRules.isPending only covers the project POST, so the
  // repo-link request that follows it would otherwise run with the button
  // re-enabled and let a second click create a duplicate. Reset on every exit
  // (see the finally in submit) rather than held until unmount, so the button
  // does not depend on the consumer unmounting on completion. The ref is the
  // synchronous re-entry guard; the state drives the button's busy/disabled UI.
  const isCompletingRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const submitTooltipText = getSubmitTooltipText(missingFields);

  const notificationRestoreCompleteRef = useRef(!projectDetailsForm?.notificationAction);

  // Blocks canSubmit until a persisted notification selection settles, then latches open
  // so later edits don't re-block. No-op when there's no saved action.
  // "Settled" means one of three things:
  //   1. Integration restored — query succeeded + INTEGRATION re-added to actions
  //   2. Integration gone    — query succeeded + picker fell back to the setup CTA
  //   3. Query failed        — unblock unconditionally so the user isn't permanently stuck
  //                           (the init effect never runs on error, so notificationPickerSettled
  //                            stays false and must NOT gate the error escape hatch)
  const notificationPickerSettled =
    notificationProps.actions.includes(MultipleCheckboxOptions.INTEGRATION) ||
    notificationProps.shouldRenderSetupButton;
  const notificationRestoreComplete =
    notificationProps.queryError ||
    (notificationProps.querySuccess && notificationPickerSettled);
  if (!notificationRestoreCompleteRef.current && notificationRestoreComplete) {
    notificationRestoreCompleteRef.current = true;
  }

  // Block submission until teams and the projects store have loaded so the
  // reuse check below can't be bypassed by a race.
  const canSubmit =
    !missingFields.projectName &&
    !missingFields.team &&
    !missingFields.platform &&
    !missingFields.notificationChannel &&
    !isCompleting &&
    !isLoadingTeams &&
    projectsLoaded &&
    notificationRestoreCompleteRef.current;

  const existingProject = createdProjectSlug
    ? projects.find(p => p.slug === createdProjectSlug)
    : undefined;

  // Platform is compared against the project record rather than a form-state
  // snapshot because the Project model tracks it; alert fields are not on the
  // Project record so we compare those against the context snapshot.
  const samePlatform = existingProject?.platform === selectedPlatform?.key;
  const savedForm = savedFormRef.current;
  const savedAlert = savedForm?.alertRuleConfig;
  const nothingChanged =
    samePlatform &&
    !!savedForm &&
    projectNameResolved === savedForm.projectName &&
    teamSlugResolved === savedForm.teamSlug &&
    alertRuleConfig.alertSetting === savedAlert?.alertSetting &&
    alertRuleConfig.interval === savedAlert?.interval &&
    alertRuleConfig.metric === savedAlert?.metric &&
    alertRuleConfig.threshold === savedAlert?.threshold &&
    isEqual(
      hasNotificationAction ? buildIntegrationAction(notificationProps) : undefined,
      savedForm?.notificationAction
    );

  const submit = useCallback(async () => {
    if (!selectedPlatform || !canSubmit || isCompletingRef.current) {
      return;
    }
    isCompletingRef.current = true;
    setIsCompleting(true);

    trackAnalytics(CREATE_CLICKED_EVENT[analyticsFlow], {organization});

    const notificationAction = hasNotificationAction
      ? buildIntegrationAction(notificationProps)
      : undefined;
    const submittedForm = {
      projectName: projectNameResolved,
      teamSlug: teamSlugResolved,
      alertRuleConfig,
      notificationAction,
    };

    try {
      // User navigated back and clicked Create without changing anything; skip
      // to completion without creating a duplicate. Any actual change abandons
      // the previous project and creates a new one, matching legacy onboarding.
      if (existingProject && nothingChanged) {
        trackAnalytics(CREATE_SUCCEEDED_EVENT[analyticsFlow], {
          organization,
          project_slug: existingProject.slug,
        });
        onComplete({project: existingProject, projectDetailsForm: submittedForm});
        return;
      }

      const {project} = await createProjectAndRules.mutateAsync({
        projectName: projectNameResolved,
        platform: selectedPlatform,
        team: isOrgMemberWithNoAccess ? undefined : teamSlugResolved,
        alertRuleConfig: getRequestDataFragment(alertRuleConfig),
        createNotificationAction,
      });

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

      trackAnalytics(CREATE_SUCCEEDED_EVENT[analyticsFlow], {
        organization,
        project_slug: project.slug,
      });

      onComplete({project, projectDetailsForm: submittedForm});
    } catch (error) {
      trackAnalytics(CREATE_FAILED_EVENT[analyticsFlow], {organization});
      addErrorMessage(t('Failed to create project'));
      Sentry.captureException(error);
    } finally {
      isCompletingRef.current = false;
      setIsCompleting(false);
    }
  }, [
    analyticsFlow,
    alertRuleConfig,
    canSubmit,
    createNotificationAction,
    createProjectAndRules,
    existingProject,
    hasNotificationAction,
    isOrgMemberWithNoAccess,
    nothingChanged,
    notificationProps,
    onComplete,
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
    notificationProps,
    isOrgMemberWithNoAccess,
    missingFields,
    submitTooltipText,
    canSubmit,
    isBusy: isCompleting,
    error: createProjectAndRules.error,
    submit,
  };
}
