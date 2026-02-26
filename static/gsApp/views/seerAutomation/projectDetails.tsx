import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {hasEveryAccess} from 'sentry/components/acl/access';
import AnalyticsArea from 'sentry/components/analyticsArea';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import OldProjectDetails from 'sentry/views/settings/projectSeer/index';

import AutofixAgent from 'getsentry/views/seerAutomation/components/projectDetails/autofixAgent';
import AutofixRepositories from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';

export default function SeerProjectDetailsPage() {
  const organization = useOrganization();
  return showNewSeer(organization) ? <SeerProjectDetails /> : <OldProjectDetails />;
}

const DEFAULT_PREFERENCE: ProjectSeerPreferences = {
  repositories: [],
  automated_run_stopping_point: 'root_cause',
  automation_handoff: undefined,
};

function SeerProjectDetails() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {codeMappingRepos, isPending, preference} = useProjectSeerPreferences(project);

  const canWrite = hasEveryAccess(['project:write'], {organization, project});

  return (
    <AnalyticsArea name="project-details">
      <SentryDocumentTitle
        title={t('Project Seer Settings')}
        projectSlug={project.slug}
      />
      <SettingsPageHeader
        title={tct('Seer Settings for [projectName]', {
          projectName: (
            <Text as="span" monospace>
              {project.slug}
            </Text>
          ),
        })}
        subtitle={t(
          'Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them.'
        )}
        action={
          <Flex gap="lg">
            <FeedbackButton
              size="md"
              feedbackOptions={{
                messagePlaceholder: t('How can we make Seer better for you?'),
                tags: {
                  ['feedback.source']: 'seer-settings-project-details',
                  ['feedback.owner']: 'coding-workflows',
                },
              }}
            />
            <LinkButton
              href="https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/"
              external
            >
              {t('Read the docs')}
            </LinkButton>
          </Flex>
        }
      />
      {canWrite ? null : (
        <Stack paddingBottom="xl">
          <Alert variant="warning">
            {t(
              'These settings can only be edited by users with the project owner or manager role.'
            )}
          </Alert>
        </Stack>
      )}
      {isPending ? (
        <LoadingIndicator />
      ) : (
        <Stack gap="2xl">
          <AutofixRepositories
            canWrite={canWrite}
            codeMappingRepos={codeMappingRepos}
            preference={preference ?? DEFAULT_PREFERENCE}
            project={project}
          />
          <AutofixAgent
            canWrite={canWrite}
            preference={preference ?? DEFAULT_PREFERENCE}
            project={project}
          />
        </Stack>
      )}
    </AnalyticsArea>
  );
}
