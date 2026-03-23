import {useCallback, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {TeamSelector} from 'sentry/components/teamSelector';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {slugify} from 'sentry/utils/slugify';
import {useTeams} from 'sentry/utils/useTeams';
import {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  getRequestDataFragment,
  IssueAlertOptions,
  type AlertRuleOptions,
} from 'sentry/views/projectInstall/issueAlertOptions';

import type {StepProps} from './types';

export function ScmProjectDetails({onComplete}: StepProps) {
  const {selectedPlatform, selectedFeatures, setCreatedProjectSlug} =
    useOnboardingContext();
  const {teams} = useTeams();
  const createProjectAndRules = useCreateProjectAndRules();

  // Notification actions (Connect to messaging) deferred to VDY-28 UI polish pass.
  // No-op avoids the API call that useCreateNotificationAction makes on mount.
  const createNotificationAction = useCallback(
    () =>
      undefined as ReturnType<
        ReturnType<typeof useCreateNotificationAction>['createNotificationAction']
      >,
    []
  );

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
    },
    []
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

      onComplete(undefined, selectedFeatures ? {product: selectedFeatures} : undefined);
    } catch (error) {
      addErrorMessage(t('Failed to create project'));
      Sentry.captureException(error);
    }
  }, [
    selectedPlatform,
    canSubmit,
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
    <Flex direction="column" align="center" gap="xl" flexGrow={1}>
      <Stack align="center" gap="md">
        <Heading as="h2">{t('Project details')}</Heading>
        <Text variant="muted">
          {t(
            'Set the project name, assign a team, and configure how you want to receive issue alerts'
          )}
        </Text>
      </Stack>

      <Stack gap="lg" width="100%" maxWidth="600px">
        <Stack gap="sm">
          <Flex gap="xs" align="center">
            <IconProject size="sm" />
            <Text bold>{t('Give your project a name')}</Text>
          </Flex>
          <Input
            type="text"
            placeholder={t('project-name')}
            value={projectNameResolved}
            onChange={e => setProjectName(slugify(e.target.value))}
          />
        </Stack>

        <Stack gap="sm">
          <Flex gap="xs" align="center">
            <Text bold>{t('Assign a team')}</Text>
          </Flex>
          <TeamSelector
            allowCreate
            name="team"
            aria-label={t('Select a Team')}
            clearable={false}
            placeholder={t('Select a Team')}
            teamFilter={(tm: Team) => tm.access.includes('team:admin')}
            value={teamSlugResolved}
            onChange={({value}: {value: string}) => setTeamSlug(value)}
          />
        </Stack>

        <Stack gap="sm">
          <Flex gap="xs" align="center">
            <Text bold>{t('Alert frequency')}</Text>
          </Flex>
          <Text variant="muted" size="sm">
            {t('Get notified when things go wrong')}
          </Text>
          <IssueAlertOptions {...alertRuleConfig} onFieldChange={handleAlertChange} />
        </Stack>
      </Stack>

      <Flex gap="md" align="center">
        <Button
          priority="primary"
          onClick={handleCreateProject}
          disabled={!canSubmit}
          icon={<IconProject />}
        >
          {t('Create project')}
        </Button>
      </Flex>
    </Flex>
  );
}
