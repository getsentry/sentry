import {useEffect} from 'react';

import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TeamSelector} from 'sentry/components/teamSelector';
import {IconGroup, IconProject, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {AlertRuleOptions} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './scmAlertFrequency';
import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';

const STEP_VIEWED_EVENT = {
  onboarding: 'onboarding.scm_project_details_step_viewed',
  'project-creation': 'project_creation.scm_project_details_step_viewed',
} as const;

interface ScmProjectDetailsCoreProps {
  alertRuleConfig: AlertRuleOptions;
  analyticsFlow: ScmAnalyticsFlow;
  /** Hides the team selector for a no-access member (see useScmProjectDetails). */
  isOrgMemberWithNoAccess: boolean;
  onAlertChange: <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => void;
  onProjectNameBlur: () => void;
  onProjectNameChange: (value: string) => void;
  onTeamChange: (option: {value: string}) => void;
  projectName: string;
  teamSlug: string;
  /** Max width of the field column. Hosts pass their own step/section width. */
  contentMaxWidth?: string;
}

/**
 * Presentational project name / team / alert-frequency form shared by the SCM
 * onboarding project-details step and the SCM-first project-creation surface.
 * Form state, the create flow, and field analytics live in `useScmProjectDetails`;
 * the host wires that hook to this component and renders its own Create button.
 * This component owns only the rendering and the `step_viewed` analytics, which
 * fires when the step becomes visible.
 */
export function ScmProjectDetailsCore({
  alertRuleConfig,
  analyticsFlow,
  isOrgMemberWithNoAccess,
  onAlertChange,
  onProjectNameBlur,
  onProjectNameChange,
  onTeamChange,
  projectName,
  teamSlug,
  contentMaxWidth,
}: ScmProjectDetailsCoreProps) {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics(STEP_VIEWED_EVENT[analyticsFlow], {organization});
  }, [organization, analyticsFlow]);

  return (
    <Stack gap="3xl" width="100%" maxWidth={contentMaxWidth}>
      <Stack gap="md">
        <Flex gap="md" align="center">
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
          value={projectName}
          onChange={e => onProjectNameChange(e.target.value)}
          onBlur={onProjectNameBlur}
        />
      </Stack>

      {!isOrgMemberWithNoAccess && (
        <Stack gap="md">
          <Flex gap="md" align="center">
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
            value={teamSlug}
            onChange={onTeamChange}
          />
        </Stack>
      )}

      <Stack gap="md">
        <Flex gap="md" align="center">
          <IconSiren size="md" />
          <Container>
            <Text bold size="lg" density="comfortable">
              {t('Alert frequency')}
            </Text>
          </Container>
        </Flex>
        <Container>
          <Text variant="muted" size="lg" density="comfortable">
            {t('Get notified when things go wrong')}
          </Text>
        </Container>
        <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
      </Stack>
    </Stack>
  );
}
