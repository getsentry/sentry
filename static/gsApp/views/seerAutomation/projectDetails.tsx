import {Alert} from '@sentry/scraps/alert';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import {ProjectSeerContainer as OldProjectDetails} from 'sentry/views/settings/projectSeer/index';

import {AutofixAgent} from 'getsentry/views/seerAutomation/components/projectDetails/autofixAgent';
import {AutofixRepositories} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';

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
      <SentryDocumentTitle title={t('Autofix for %s', project.slug)} />
      <SettingsPageHeader
        title={
          <Flex align="baseline" gap="md">
            {tct('Autofix for [projectName]', {
              projectName: (
                <Text as="span" monospace>
                  {project.slug}
                </Text>
              ),
            })}
          </Flex>
        }
        subtitle={tct(
          'Connect repositories to projects, and choose which Agent should automatically process issues. [docs:Read the docs] to learn what Seer can do.',
          {
            docs: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
            ),
          }
        )}
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
