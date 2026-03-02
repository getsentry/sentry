import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {t, tct} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import SeerSettingsPageContent from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationProjects() {
  return (
    <AnalyticsArea name="projects">
      <SeerSettingsPageWrapper>
        <SettingsPageHeader
          title={t('Seer Autofix')}
          subtitle={tct(
            `Configure [rca:Issue Autofix] by connecting your repositories with projects. Connecting your source code is required and gives the coding agent context for Root Cause Analysis, Solution generation, and PR creation. Enable an Autofix Agent to automatically process and fix actionable issues as they are detected. [read_the_docs:Read the docs] to learn what Seer can do.`,
            {
              rca: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/root-cause-analysis/#root-cause-analysis" />
              ),
              read_the_docs: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
              ),
            }
          )}
        />
        <SeerSettingsPageContent>
          <SeerProjectTable />
        </SeerSettingsPageContent>
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
