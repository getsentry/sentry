import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Stack} from '@sentry/scraps/layout/stack';
import {ExternalLink} from '@sentry/scraps/link';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SettingsPageTabs from 'getsentry/views/seerAutomation/components/settingsPageTabs';

interface Props {
  children: React.ReactNode;
}

export default function SeerSettingsPageWrapper({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['seer-settings-gtm']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Seer')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer')}
        subtitle={tct(
          'Choose how Seer automatically triages and diagnoses incoming issues before you even notice them. Seer currently includes [autofix:Autofix], an agent that can root-cause issues and create pull requests, and [code_review:AI Code Review], an agent that will review your pull requests to detect issues before they happen.',
          {
            autofix: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/#root-cause-analysis" />
            ),
            code_review: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-code-review/" />
            ),
          }
        )}
        action={
          <LinkButton
            href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities"
            external
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />

      <Stack gap="lg">
        <SettingsPageTabs />
        {children}
      </Stack>
    </Feature>
  );
}
