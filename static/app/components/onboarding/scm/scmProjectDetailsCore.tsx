import {Input} from '@sentry/scraps/input';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {TeamSelector} from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';

interface ScmProjectDetailsCoreProps {
  /** Hides the team selector for a no-access member (see useScmProjectDetails). */
  isOrgMemberWithNoAccess: boolean;
  onProjectNameBlur: () => void;
  onProjectNameChange: (value: string) => void;
  onTeamChange: (option: {value: string}) => void;
  projectName: string;
  teamSlug: string;
}

/**
 * Presentational project name and team form for SCM-first project creation.
 * Alert frequency is rendered separately by `ScmAlertFrequencySection`; form
 * state, creation, and field analytics live in `useScmProjectDetails`.
 */
export function ScmProjectDetailsCore({
  isOrgMemberWithNoAccess,
  onProjectNameBlur,
  onProjectNameChange,
  onTeamChange,
  projectName,
  teamSlug,
}: ScmProjectDetailsCoreProps) {
  return (
    <Grid width="100%" columns={{zero: '1fr', '3xl': '1fr 1fr'}} gap="xl">
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
                {t('This team can access the project and receive alerts')}
              </Text>
            </Container>
          </Stack>
        </Stack>
      )}
    </Grid>
  );
}
