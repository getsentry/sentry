import {useEffect} from 'react';

import {Input} from '@sentry/scraps/input';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TeamSelector} from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {AlertRuleOptions} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './scmAlertFrequency';
import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmCollapsibleSection} from './scmCollapsibleSection';

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

  // Match the feature-selection section: the alert-frequency section folds away
  // in project creation (one of several stacked config cards) but stays always
  // expanded in onboarding.
  const collapsible = analyticsFlow === 'project-creation';

  useEffect(() => {
    trackAnalytics(STEP_VIEWED_EVENT[analyticsFlow], {organization});
  }, [organization, analyticsFlow]);

  const alertFrequencyBody = (
    <Stack gap="md" width="100%">
      <Text variant="muted" density="comfortable">
        {t('Get notified when things go wrong')}
      </Text>
      <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
    </Stack>
  );

  return (
    <Stack gap="3xl" width="100%" maxWidth={contentMaxWidth}>
      <Grid width="100%" columns={{sm: '1fr', md: '1fr 1fr'}} gap="2xl">
        <Stack gap="md">
          <Stack gap="xs">
            <Container>
              <Text bold size="md" density="comfortable">
                {t('Project name')}
              </Text>
            </Container>
            <Container>
              <Text variant="muted" density="comfortable">
                {t('Slug used in URLs and SDK config')}
              </Text>
            </Container>
          </Stack>
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
            <Stack gap="xs">
              <Container>
                <Text bold size="md" density="comfortable">
                  {t('Team')}
                </Text>
              </Container>
              <Container>
                <Text variant="muted" density="comfortable">
                  {t('Set who owns alerts for this project')}
                </Text>
              </Container>
            </Stack>
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
      </Grid>

      {collapsible ? (
        <ScmCollapsibleSection title={t('Alert frequency')}>
          {alertFrequencyBody}
        </ScmCollapsibleSection>
      ) : (
        <Stack gap="md">
          <Stack gap="xs">
            <Container>
              <Text bold size="md" density="comfortable">
                {t('Alert frequency')}
              </Text>
            </Container>
            <Container>
              <Text variant="muted" density="comfortable">
                {t('Get notified when things go wrong')}
              </Text>
            </Container>
          </Stack>
          <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
        </Stack>
      )}
    </Stack>
  );
}
