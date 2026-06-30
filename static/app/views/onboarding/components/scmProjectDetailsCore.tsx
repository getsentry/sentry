import {useEffect} from 'react';

import {Input} from '@sentry/scraps/input';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {TeamSelector} from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';

interface ScmProjectDetailsCoreProps {
  analyticsFlow: ScmAnalyticsFlow;
  /** Hides the team selector for a no-access member (see useScmProjectDetails). */
  isOrgMemberWithNoAccess: boolean;
  onProjectNameBlur: () => void;
  onProjectNameChange: (value: string) => void;
  onTeamChange: (option: {value: string}) => void;
  projectName: string;
  teamSlug: string;
}

/**
 * Presentational project name / team form shared by the SCM onboarding
 * project-details step and the SCM-first project-creation surface. Alert
 * frequency is rendered separately as a sibling (`ScmAlertFrequencySection`).
 * Form state, the create flow, and field analytics live in `useScmProjectDetails`;
 * the host wires that hook to this component and renders its own Create button.
 * This component owns the `step_viewed` analytic, which fires when the step
 * becomes visible.
 */
export function ScmProjectDetailsCore({
  analyticsFlow,
  isOrgMemberWithNoAccess,
  onProjectNameBlur,
  onProjectNameChange,
  onTeamChange,
  projectName,
  teamSlug,
}: ScmProjectDetailsCoreProps) {
  const organization = useOrganization();

  useEffect(() => {
    // Onboarding views this as a discrete step. Single-view project creation
    // shows all sections at once and fires one page-viewed event in
    // scmCreateProject, so suppress the per-section step_viewed there.
    if (analyticsFlow !== 'onboarding') {
      return;
    }
    trackAnalytics('onboarding.scm_project_details_step_viewed', {organization});
  }, [organization, analyticsFlow]);

  return (
    <Grid width="100%" columns={{'screen:sm': '1fr', 'screen:md': '1fr 1fr'}} gap="xl">
      <Stack gap="md">
        <Container>
          <Heading as="h4">{t('Project name')}</Heading>
        </Container>

        <Stack gap="xs">
          <Input
            type="text"
            placeholder={t('project-name')}
            value={projectName}
            onChange={e => onProjectNameChange(e.target.value)}
            onBlur={onProjectNameBlur}
          />
          <Container>
            <Text variant="muted" density="comfortable" size="sm">
              {t('Slug used in URLs and SDK config')}
            </Text>
          </Container>
        </Stack>
      </Stack>

      {!isOrgMemberWithNoAccess && (
        <Stack gap="md">
          <Container>
            <Heading as="h4">{t('Team')}</Heading>
          </Container>

          <Stack gap="xs">
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
            <Container>
              <Text variant="muted" density="comfortable" size="sm">
                {t('Set who owns alerts for this project')}
              </Text>
            </Container>
          </Stack>
        </Stack>
      )}
    </Grid>
  );
}
