import {useCallback, useState} from 'react';
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
import type {PlatformKey} from 'sentry/types/project';
import {slugify} from 'sentry/utils/slugify';
import {useTeams} from 'sentry/utils/useTeams';
import {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  getRequestDataFragment,
  IssueAlertOptions,
  RuleAction,
  type AlertRuleOptions,
} from 'sentry/views/projectInstall/issueAlertOptions';

import type {StepProps} from './types';

export function ScmProjectDetails({onComplete}: StepProps) {
  const {selectedPlatform, selectedRepository, setSelectedPlatform} =
    useOnboardingContext();
  const {teams} = useTeams();
  const createProjectAndRules = useCreateProjectAndRules();
  const {createNotificationAction} = useCreateNotificationAction();

  const firstAdminTeam = teams.find((team: Team) => team.access.includes('team:admin'));

  const defaultName = slugify(selectedRepository?.name ?? selectedPlatform?.key ?? '');

  const [projectName, setProjectName] = useState(defaultName);
  const [teamSlug, setTeamSlug] = useState(firstAdminTeam?.slug ?? '');
  const [alertRuleConfig, setAlertRuleConfig] = useState<AlertRuleOptions>({
    alertSetting: RuleAction.DEFAULT_ALERT,
    threshold: '10',
    metric: 0,
    interval: '1m',
  });

  const handleAlertChange = <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => {
    setAlertRuleConfig(prev => ({...prev, [key]: value}));
  };

  const canSubmit =
    projectName.length > 0 &&
    teamSlug.length > 0 &&
    !!selectedPlatform &&
    !createProjectAndRules.isPending;

  const handleCreateProject = useCallback(async () => {
    if (!selectedPlatform || !canSubmit) {
      return;
    }

    try {
      const {project} = await createProjectAndRules.mutateAsync({
        projectName,
        platform: selectedPlatform,
        team: teamSlug,
        alertRuleConfig: getRequestDataFragment(alertRuleConfig),
        createNotificationAction,
      });

      // onboarding.tsx uses selectedPlatform.key as the project slug for
      // useRecentCreatedProject lookup. The types don't align (PlatformKey vs
      // string) because the field is overloaded for both purposes.
      setSelectedPlatform({
        ...selectedPlatform,
        key: project.slug as PlatformKey,
      });

      onComplete();
    } catch (error) {
      addErrorMessage(t('Failed to create project'));
      Sentry.captureException(error);
    }
  }, [
    selectedPlatform,
    canSubmit,
    createProjectAndRules,
    projectName,
    teamSlug,
    alertRuleConfig,
    createNotificationAction,
    setSelectedPlatform,
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
            value={projectName}
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
            value={teamSlug}
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
        <Button onClick={() => onComplete()}>{t('Back')}</Button>
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
