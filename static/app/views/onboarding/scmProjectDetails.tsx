import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
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
import {useTeams} from 'sentry/utils/useTeams';
import {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  getRequestDataFragment,
  type AlertRuleOptions,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './components/scmAlertFrequency';
import {ScmStepFooter} from './components/scmStepFooter';
import {ScmStepHeader} from './components/scmStepHeader';
import {SCM_STEP_CONTENT_WIDTH} from './consts';
import type {StepProps} from './types';

export function ScmProjectDetails({onComplete}: StepProps) {
  const organization = useOrganization();
  const {selectedPlatform, selectedFeatures, setCreatedProjectSlug} =
    useOnboardingContext();
  const {teams} = useTeams();
  const createProjectAndRules = useCreateProjectAndRules();
  const {createNotificationAction, notificationProps} = useCreateNotificationAction();

  useEffect(() => {
    trackAnalytics('onboarding.scm_project_details_step_viewed', {organization});
  }, [organization]);

  const firstAdminTeam = useMemo(
    () => teams.find((team: Team) => team.access.includes('team:admin')),
    [teams]
  );
  const defaultName = slugify(selectedPlatform?.key ?? '');

  // State tracks user edits; derived values fall back to defaults from context/teams
  const [projectName, setProjectName] = useState<string | null>(null);
  const [teamSlug, setTeamSlug] = useState<string | null>(null);

  const projectNameResolved = projectName ?? defaultName;
  const teamSlugResolved = teamSlug ?? firstAdminTeam?.slug ?? '';

  const [alertRuleConfig, setAlertRuleConfig] = useState<AlertRuleOptions>(
    DEFAULT_ISSUE_ALERT_OPTIONS_VALUES
  );

  const handleAlertChange = useCallback(
    <K extends keyof AlertRuleOptions>(key: K, value: AlertRuleOptions[K]) => {
      setAlertRuleConfig(prev => ({...prev, [key]: value}));
      if (key === 'alertSetting') {
        const optionMap: Record<number, string> = {
          0: 'high_priority',
          1: 'custom',
          2: 'create_later',
        };
        trackAnalytics('onboarding.scm_project_details_alert_selected', {
          organization,
          option: optionMap[value as number] ?? String(value),
        });
      }
    },
    [organization]
  );

  const canSubmit =
    projectNameResolved.length > 0 &&
    teamSlugResolved.length > 0 &&
    !!selectedPlatform &&
    !createProjectAndRules.isPending;

  const handleCreateProject = useCallback(async () => {
    if (!selectedPlatform || !canSubmit) {
      return;
    }

    trackAnalytics('onboarding.scm_project_details_create_clicked', {organization});

    try {
      const {project} = await createProjectAndRules.mutateAsync({
        projectName: projectNameResolved,
        platform: selectedPlatform,
        team: teamSlugResolved,
        alertRuleConfig: getRequestDataFragment(alertRuleConfig),
        createNotificationAction,
      });

      // Store the project slug separately so onboarding.tsx can find
      // the project via useRecentCreatedProject without corrupting
      // selectedPlatform.key (which the platform features step needs).
      setCreatedProjectSlug(project.slug);

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
  }, [
    selectedPlatform,
    canSubmit,
    organization,
    createProjectAndRules,
    projectNameResolved,
    teamSlugResolved,
    alertRuleConfig,
    createNotificationAction,
    selectedFeatures,
    setCreatedProjectSlug,
    onComplete,
  ]);

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        stepNumber={3}
        heading={t('Project details')}
        subtitle={t(
          'Set the project name, assign a team, and configure how you want to receive issue alerts'
        )}
      />

      <LayoutGroup>
        <MotionStack
          gap="2xl"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          layout="position"
        >
          <Stack gap="sm">
            <Flex gap="md" align="center">
              <IconProject legacySize="16px" />
              <Text bold size="lg" density="comfortable">
                {t('Give your project a name')}
              </Text>
            </Flex>
            <Input
              type="text"
              placeholder={t('project-name')}
              value={projectNameResolved}
              onChange={e => setProjectName(slugify(e.target.value))}
              onBlur={() => {
                if (projectName !== null) {
                  trackAnalytics('onboarding.scm_project_details_name_edited', {
                    organization,
                    custom: projectName !== defaultName,
                  });
                }
              }}
            />
          </Stack>

          <Stack gap="sm">
            <Flex gap="md" align="center">
              <IconGroup legacySize="16px" />
              <Text bold size="lg" density="comfortable">
                {t('Assign a team')}
              </Text>
            </Flex>
            <TeamSelector
              allowCreate
              name="team"
              aria-label={t('Select a Team')}
              clearable={false}
              placeholder={t('Select a Team')}
              teamFilter={(tm: Team) => tm.access.includes('team:admin')}
              value={teamSlugResolved}
              onChange={({value}: {value: string}) => {
                setTeamSlug(value);
                trackAnalytics('onboarding.scm_project_details_team_selected', {
                  organization,
                  team: value,
                });
              }}
            />
          </Stack>

          <Stack gap="sm">
            <Flex gap="md" align="center">
              <IconSiren legacySize="16px" />
              <Text bold size="lg" density="comfortable">
                {t('Alert frequency')}
              </Text>
            </Flex>
            <Text variant="muted" size="lg" density="comfortable">
              {t('Get notified when things go wrong')}
            </Text>
            <ScmAlertFrequency
              {...alertRuleConfig}
              onFieldChange={handleAlertChange}
              notificationProps={notificationProps}
            />
          </Stack>
        </MotionStack>

        <MotionStack layout="position" width="100%" align="center">
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
        </MotionStack>
      </LayoutGroup>
    </Flex>
  );
}

const MotionStack = motion.create(Stack);
