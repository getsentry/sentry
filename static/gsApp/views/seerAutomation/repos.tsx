import {Outlet} from 'react-router-dom';

import {LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconSettings} from 'sentry/icons/iconSettings';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SeerRepoTable} from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {orgHasCodeReviewFeature} from 'getsentry/views/seerAutomation/utils';

export default function SeerAutomationRepos() {
  const organization = useOrganization();
  const location = useLocation();

  if (!orgHasCodeReviewFeature(organization)) {
    return (
      <AnalyticsArea name="repos">
        <NoAccess />
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="repos">
      <SentryDocumentTitle title={t('Code Review')} />
      <SettingsPageHeader
        title={t('Code Review')}
        action={
          <LinkButton
            size="sm"
            icon={<IconSettings />}
            to={{
              pathname: `/settings/${organization.slug}/seer/repos/defaults/`,
              query: location.query,
            }}
          >
            {t('Defaults')}
          </LinkButton>
        }
        subtitle={tct(
          "Enable [code_review:Code Review] on your repositories to automatically catch bugs before they're merged into production. Reviews can be triggered when a PR is ready for review, after each update to a PR, and always manually by tagging [code:@sentry review] in the comments. [docs:Read the docs] to learn what Seer can do.",
          {
            code: <code />,
            code_review: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/code-review/" />
            ),
            docs: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
            ),
          }
        )}
      />
      <SeerSettingsPageContent>
        <SeerRepoTable />
      </SeerSettingsPageContent>
      <Outlet />
    </AnalyticsArea>
  );
}
