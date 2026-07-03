import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {AutofixAgent} from 'sentry/components/seer/projectDetails/autofixAgent';
import {AutofixRepositoriesList} from 'sentry/components/seer/projectDetails/autofixRepositoriesList';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

export function SeerProjectDetails({project}: {project: DetailedProject}) {
  const organization = useOrganization();

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

      <Stack gap="2xl">
        <AutofixRepositoriesList
          canWrite={canWrite}
          includeInstructions={false}
          project={project}
        />
        <AutofixAgent canWrite={canWrite} project={project} />
      </Stack>
    </AnalyticsArea>
  );
}
