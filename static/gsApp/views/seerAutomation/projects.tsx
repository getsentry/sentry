import {Outlet} from 'react-router-dom';

import {LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconSettings} from 'sentry/icons/iconSettings';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SeerProjectTable} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';

export default function SeerAutomationProjects() {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <AnalyticsArea name="projects">
      <SentryDocumentTitle title={t('Autofix')} />
      <SettingsPageHeader
        title={t('Autofix')}
        action={
          <LinkButton
            size="sm"
            icon={<IconSettings />}
            to={{
              pathname: `/settings/${organization.slug}/seer/projects/defaults/`,
              query: location.query,
            }}
          >
            {t('Defaults')}
          </LinkButton>
        }
        subtitle={tct(
          'Configure [rca:Autofix] by connecting your repositories with projects. Connecting your source code is required and gives the coding agent context for Root Cause Analysis, Solution generation, and PR creation. Enable Autofix Handoff to automatically process and fix actionable issues as they are detected. [docs:Read the docs] to learn what Seer can do.',
          {
            rca: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#root-cause-analysis" />
            ),
            docs: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
            ),
          }
        )}
      />
      <SeerSettingsPageContent>
        <SeerProjectTable />
      </SeerSettingsPageContent>
      <Outlet />
    </AnalyticsArea>
  );
}
