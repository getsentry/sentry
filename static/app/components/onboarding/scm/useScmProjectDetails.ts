import {useCallback, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {captureProjectCreationFailure} from 'sentry/components/onboarding/captureProjectCreationFailure';
import {linkProjectToRepository} from 'sentry/components/onboarding/scm/linkProjectToRepository';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/scm/scmProjectDetailsTypes';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {slugify} from 'sentry/utils/slugify';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {
  buildNotificationSelection,
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useScmNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  getRequestDataFragment,
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

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
 * Drives the SCM-first project-creation form, create-project and repo-link flow,
 * and project-creation analytics. The host owns the controlled form state and
 * renders the presentational sections and Create button.
 */
export function useScmProjectDetails({
  onComplete,
  onProjectDetailsFormChange,
  projectDetailsForm,
  selectedPlatform,
  selectedRepository,
  createdProjectSlug,
}: UseScmProjectDetailsOptions): ScmProjectDetailsForm {
  const organization = useOrganization();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();

  const restoredNotificationSelectionRef = useRef(
    projectDetailsForm?.notificationSelection
  );

  // Provides the messaging-integration notification picker (notificationProps,
  // rendered in ScmAlertFrequencySection) and the side-effect that creates the
  // chosen notification rule at project creation.
  const {createNotificationAction, notificationProps} = useScmNotificationAction(
    restoredNotificationSelectionRef.current
  );

  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));
  const firstAdminTeam = accessTeams[0];
  // A member with no admin team who also cannot create one may still create a
  // project; the backend assigns a team, matching classic project creation.
  const isOrgMemberWithNoAccess =
    accessTeams.length === 0 && !organization.access.includes('project:admin');
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
      trackAnalytics('project_creation.project_details_name_edited', {
        organization,
        custom: projectDetailsForm.projectName !== defaultName,
        variant: 'scm',
      });
    }
  }, [projectDetailsForm?.projectName, defaultName, organization]);

  const onTeamChange = useCallback(
    ({value}: {value: string}) => {
      onProjectDetailsFormChange({...projectDetailsForm, teamSlug: value});
      trackAnalytics('project_creation.project_details_team_selected', {
        organization,
        team: value,
        variant: 'scm',
      });
    },
    [onProjectDetailsFormChange, projectDetailsForm, organization]
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
        trackAnalytics('project_creation.project_details_alert_selected', {
          organization,
          option: optionMap[value as number] ?? String(value),
          variant: 'scm',
        });
      } else if (key === 'threshold' || key === 'metric' || key === 'interval') {
        trackAnalytics('project_creation.alert_threshold_edited', {
          organization,
          field: key,
          variant: 'scm',
        });
      }
    },
    [onProjectDetailsFormChange, projectDetailsForm, alertRuleConfig, organization]
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

  const notificationRestoreCompleteRef = useRef(
    !projectDetailsForm?.notificationSelection
  );

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
  // Project record so we compare those against the saved form snapshot.
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
      hasNotificationAction ? buildNotificationSelection(notificationProps) : undefined,
      savedForm?.notificationSelection
    );

  const submit = useCallback(async () => {
    if (!selectedPlatform || !canSubmit || isCompletingRef.current) {
      return;
    }
    isCompletingRef.current = true;
    setIsCompleting(true);

    trackAnalytics('project_creation.project_details_create_clicked', {
      organization,
      variant: 'scm',
    });

    const notificationSelection = hasNotificationAction
      ? buildNotificationSelection(notificationProps)
      : undefined;
    const submittedForm = {
      projectName: projectNameResolved,
      teamSlug: teamSlugResolved,
      alertRuleConfig,
      notificationSelection,
    };
    // Mirror the legacy project_creation_page.created `issue_alert` breakdown
    // (see createProject.tsx): Custom > Default > No Rule, derived from the
    // configured alert setting.
    let issueAlert: 'Custom' | 'Default' | 'No Rule';
    switch (alertRuleConfig.alertSetting) {
      case RuleAction.CUSTOMIZED_ALERTS:
        issueAlert = 'Custom';
        break;
      case RuleAction.CREATE_ALERT_LATER:
        issueAlert = 'No Rule';
        break;
      default:
        issueAlert = 'Default';
    }

    try {
      // User navigated back and clicked Create without changing anything; skip
      // to completion without creating a duplicate. Any actual change abandons
      // the previous project and creates a new one, matching legacy onboarding.
      if (existingProject && nothingChanged) {
        // Back-nav "nothing changed" path: no project or rules were created
        // this pass, so the rule breakdown reflects "nothing new created now"
        // while issue_alert echoes the configured setting.
        trackAnalytics('project_creation_page.created', {
          organization,
          project_id: existingProject.id,
          platform: selectedPlatform.key,
          issue_alert: issueAlert,
          notification_rule_created: false,
          rule_ids: [],
          variant: 'scm',
        });
        onComplete({project: existingProject, projectDetailsForm: submittedForm});
        return;
      }

      const creation = await createProjectAndRules
        .mutateAsync({
          projectName: projectNameResolved,
          platform: selectedPlatform,
          team: isOrgMemberWithNoAccess ? undefined : teamSlugResolved,
          alertRuleConfig: getRequestDataFragment(alertRuleConfig),
          createNotificationAction,
        })
        .catch(error => {
          trackAnalytics('project_creation.project_details_create_failed', {
            organization,
            variant: 'scm',
          });
          addErrorMessage(t('Failed to create project'));
          captureProjectCreationFailure({
            error,
            organization,
            team: isOrgMemberWithNoAccess ? undefined : teamSlugResolved,
            accessTeams,
            variant: 'scm',
          });
          return null;
        });
      if (!creation) {
        return;
      }
      const {project, ruleIds, notificationRule} = creation;

      if (selectedRepository?.id) {
        await linkProjectToRepository({
          orgSlug: organization.slug,
          projectSlug: project.slug,
          repositoryId: selectedRepository.id,
        });
      }

      trackAnalytics('project_creation_page.created', {
        organization,
        project_id: project.id,
        platform: selectedPlatform.key,
        issue_alert: issueAlert,
        notification_rule_created: !!notificationRule,
        rule_ids: ruleIds,
        variant: 'scm',
      });

      onComplete({project, projectDetailsForm: submittedForm});
    } finally {
      isCompletingRef.current = false;
      setIsCompleting(false);
    }
  }, [
    accessTeams,
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
