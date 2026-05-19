import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {AutofixAgent} from 'getsentry/views/seerAutomation/components/projectDetails/autofixAgent';
import {AutofixRepositories} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';
import {NightShift} from 'getsentry/views/seerAutomation/components/projectDetails/nightShift';

const DEFAULT_PREFERENCE: ProjectSeerPreferences = {
  repositories: [],
  automated_run_stopping_point: 'root_cause',
  automation_handoff: undefined,
};

export function SeerProjectDetails({project}: {project: DetailedProject}) {
  const organization = useOrganization();
  const {data, isPending, isError} = useProjectSeerPreferences(project);
  const {preference, code_mapping_repos: codeMappingRepos} = data ?? {};

  const canWrite = hasEveryAccess(['project:write'], {organization, project});

  return (
    <AnalyticsArea name="project-details">
      <SentryDocumentTitle title={t('Seer for %s', project.slug)} />
      <SettingsPageHeader
        title={t('Seer')}
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
      ) : isError ? (
        <LoadingError message={t('Failed to load Seer settings')} />
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
          <Feature features="organizations:seer-night-shift-settings">
            <NightShift canWrite={canWrite} project={project} />
          </Feature>
        </Stack>
      )}
    </AnalyticsArea>
  );
}
