import {ExternalLink} from '@sentry/scraps/link';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SeerRepoTable} from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {orgHasCodeReviewFeature} from 'getsentry/views/seerAutomation/utils';

export default function SeerAutomationRepos() {
  const organization = useOrganization();

  if (!orgHasCodeReviewFeature(organization)) {
    return (
      <AnalyticsArea name="repos">
        <NoAccess />
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="repos">
      <SeerSettingsPageWrapper>
        <SentryDocumentTitle title={t('Code Review')} />
        <SettingsPageHeader
          title={t('Code Review')}
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
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
