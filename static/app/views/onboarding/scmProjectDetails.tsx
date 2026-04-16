import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {TeamSelector} from 'sentry/components/teamSelector';
import {IconGroup, IconProject, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {slugify} from 'sentry/utils/slugify';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  getRequestDataFragment,
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './components/scmAlertFrequency';
import {ScmStepFooter} from './components/scmStepFooter';
import {ScmStepHeader} from './components/scmStepHeader';
import type {StepProps} from './types';

const PROJECT_DETAILS_WIDTH = '285px';

export function ScmProjectDetails({onComplete}: StepProps) {
  const organization = useOrganization();
  const {
    selectedPlatform,
    selectedFeatures,
    createdProjectSlug,
    setCreatedProjectSlug,
    projectDetailsForm,
    setProjectDetailsForm,
  } = useOnboardingContext();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const createProjectAndRules = useCreateProjectAndRules();
  useEffect(() => {
    trackAnalytics('onboarding.scm_project_details_step_viewed', {organization});
  }, [organization]);

  const firstAdminTeam = teams.find((team: Team) => team.access.includes('team:admin'));
  const defaultName = slugify(selectedPlatform?.key ?? '');

  // State tracks user edits. When the user navigates back from setup-docs
  // the persisted projectDetailsForm restores their previous inputs.
  const [projectName, setProjectName] = useState<string | null>(
    projectDetailsForm?.projectName ?? null
  );
  const [teamSlug, setTeamSlug] = useState<string | null>(
    projectDetailsForm?.teamSlug ?? null
  );

  const projectNameResolved = projectName ?? defaultName;
  const teamSlugResolved = teamSlug ?? firstAdminTeam?.slug ?? '';

  const [alertRuleConfig, setAlertRuleConfig] = useState<AlertRuleOptions>(
    projectDetailsForm?.alertRuleConfig ?? DEFAULT_ISSUE_ALERT_OPTIONS_VALUES
  );

  function handleAlertChange<K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) {
    setAlertRuleConfig(prev => ({...prev, [key]: value}));
    if (key === 'alertSetting') {
      const optionMap: Record<number, string> = {
        [RuleAction.DEFAULT_ALERT]: 'high_priority',
        [RuleAction.CUSTOMIZED_ALERTS]: 'custom',
        [RuleAction.CREATE_ALERT_LATER]: 'create_later',
      };
      trackAnalytics('onboarding.scm_project_details_alert_selected', {
        organization,
        option: optionMap[value as number] ?? String(value),
      });
    }
  }

  function handleProjectNameBlur() {
    if (projectName !== null) {
      trackAnalytics('onboarding.scm_project_details_name_edited', {
        organization,
        custom: projectName !== defaultName,
      });
    }
  }

  function handleTeamChange({value}: {value: string}) {
    setTeamSlug(value);
    trackAnalytics('onboarding.scm_project_details_team_selected', {
      organization,
      team: value,
    });
  }

  // Block submission until teams and the projects store have loaded so the
  // reuse check below can't be bypassed by a race.
  const canSubmit =
    projectNameResolved.length > 0 &&
    teamSlugResolved.length > 0 &&
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

  async function handleCreateProject() {
    if (!selectedPlatform || !canSubmit) {
      return;
    }

    trackAnalytics('onboarding.scm_project_details_create_clicked', {organization});

    // User navigated back and clicked Create without changing anything; skip
    // to setup-docs without creating a duplicate. Any actual change abandons
    // the previous project and creates a new one, matching legacy onboarding.
    if (existingProject && nothingChanged) {
      trackAnalytics('onboarding.scm_project_details_create_succeeded', {
        organization,
        project_slug: existingProject.slug,
      });
      onComplete(undefined, selectedFeatures ? {product: selectedFeatures} : undefined);
      return;
    }

    try {
      const {project} = await createProjectAndRules.mutateAsync({
        projectName: projectNameResolved,
        platform: selectedPlatform,
        team: teamSlugResolved,
        alertRuleConfig: getRequestDataFragment(alertRuleConfig),
        createNotificationAction: () => undefined,
      });

      // Store the project slug separately so onboarding.tsx can find
      // the project via useRecentCreatedProject without corrupting
      // selectedPlatform.key (which the platform features step needs).
      setCreatedProjectSlug(project.slug);
      setProjectDetailsForm({
        projectName: projectNameResolved,
        teamSlug: teamSlugResolved,
        alertRuleConfig,
      });

      trackAnalytics('onboarding.scm_project_details_create_succeeded', {
        organization,
        project_slug: project.slug,
      });

      onComplete(undefined, selectedFeatures ? {product: selectedFeatures} : undefined);
    } catch (error) {
      trackAnalytics('onboarding.scm_project_details_create_failed', {organization});
      addErrorMessage(t('Failed to create project'));
      Sentry.captureException(error);
    }
  }

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        heading={t('Project details')}
        subtitle={t(
          'Set the project name, assign a team, and configure\nhow you want to receive issue alerts'
        )}
      />

      <Stack gap="3xl" width="100%" maxWidth={PROJECT_DETAILS_WIDTH}>
        <Stack gap="md">
          <Flex gap="md" align="center" justify="center">
            <IconProject size="md" variant="secondary" />
            <Container>
              <Text bold size="lg" density="comfortable">
                {t('Give your project a name')}
              </Text>
            </Container>
          </Flex>
          <Input
            type="text"
            placeholder={t('project-name')}
            value={projectNameResolved}
            onChange={e => setProjectName(slugify(e.target.value))}
            onBlur={handleProjectNameBlur}
          />
        </Stack>

        <Stack gap="md">
          <Flex gap="md" align="center" justify="center">
            <IconGroup size="md" />
            <Container>
              <Text bold size="lg" density="comfortable">
                {t('Assign a team')}
              </Text>
            </Container>
          </Flex>
          <TeamSelector
            allowCreate
            name="team"
            aria-label={t('Select a Team')}
            clearable={false}
            placeholder={t('Select a Team')}
            teamFilter={(tm: Team) => tm.access.includes('team:admin')}
            value={teamSlugResolved}
            onChange={handleTeamChange}
          />
        </Stack>

        <Stack gap="md">
          <Flex gap="md" align="center" justify="center">
            <IconSiren size="md" />
            <Container>
              <Text bold size="lg" density="comfortable">
                {t('Alert frequency')}
              </Text>
            </Container>
          </Flex>
          <Container>
            <Text variant="muted" size="lg" density="comfortable" align="center">
              {t('Get notified when things go wrong')}
            </Text>
          </Container>
          <ScmAlertFrequency {...alertRuleConfig} onFieldChange={handleAlertChange} />
        </Stack>
      </Stack>

      <ScmStepFooter>
        <Button
          priority="primary"
          onClick={handleCreateProject}
          disabled={!canSubmit}
          busy={createProjectAndRules.isPending}
          icon={<IconProject />}
        >
          {t('Create project')}
        </Button>
      </ScmStepFooter>
    </Flex>
  );
}
