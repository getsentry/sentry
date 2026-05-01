import {ExternalLink} from '@sentry/scraps/link';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {
  SCMOverviewSection,
  useSCMOverviewSection,
} from 'sentry/views/settings/seer/overview/scmOverviewSection';

import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const scmOverviewData = useSCMOverviewSection();

  return (
    <SeerSettingsPageWrapper>
      <SentryDocumentTitle title={t('Seer Overview')} />
      <SettingsPageHeader
        title={t('Seer Overview')}
        subtitle={tct(
          'Configure how Seer works with your codebase. Seer includes [autofix:Autofix] and [code_review:Code Review]. Autofix will triage your Issues as they are created, and can automatically send them to a coding agent for Root Cause Analysis, Solution generation, and PR creation. Code Review will review your pull requests to detect issues before they happen. [docs:Read the docs] to learn what Seer can do.',
          {
            autofix: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/" />
            ),
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
        <SCMOverviewSection
          {...scmOverviewData}
          canWrite={canWrite}
          organizationSlug={organization.slug}
        />
      </SeerSettingsPageContent>
    </SeerSettingsPageWrapper>
  );
}
