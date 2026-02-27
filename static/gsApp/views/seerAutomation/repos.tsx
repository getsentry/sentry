import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {t, tct} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerRepoTable from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import SeerSettingsPageContent from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationRepos() {
  return (
    <AnalyticsArea name="repos">
      <SeerSettingsPageWrapper>
        <SettingsPageHeader
          title={t('Seer Code Review')}
          subtitle={tct(
            `Enable [code_review:Code-Review] on your repositories to automatically catch bugs before they're merged into production. Reviews can be triggered when a PR is ready for review, after each update to a PR, and always manually by tagging [code:@sentry review] in the comments. [read_the_docs:Read the docs] to learn what Seer can do.`,
            {
              code: <code />,
              code_review: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/ai-code-review/" />
              ),
              read_the_docs: (
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
