import {useEffect} from 'react';

import {Alert} from '@sentry/scraps/alert/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Stack} from '@sentry/scraps/layout/stack';
import {ExternalLink} from '@sentry/scraps/link';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerWizardSetupBanner from 'getsentry/views/seerAutomation/components/seerWizardSetupBanner';
import SettingsPageTabs from 'getsentry/views/seerAutomation/components/settingsPageTabs';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  children: React.ReactNode;
}

export default function SeerSettingsPageWrapper({children}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  useEffect(() => {
    // If the org is on the old-seer plan then they shouldn't be here on this new settings page
    // Or if we havn't launched the new seer yet.
    // Then they need to see old settings page, or get downgraded off old seer.
    if (!showNewSeer(organization)) {
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/`));
      return;
    }

    // If the org is not on the seat-based seer plan, then they should be redirected to the trial page
    if (!organization.features.includes('seat-based-seer-enabled')) {
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/trial/`));
      return;
    }

    // Else you do have the new seer plan, then stay here and edit some settings.
  }, [navigate, organization.features, organization.slug, organization]);

  return (
    <Feature
      features={['seat-based-seer-enabled']}
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
        <SeerWizardSetupBanner />

        <SettingsPageTabs />

        {canWrite ? null : (
          <Alert data-test-id="org-permission-alert" type="warning">
            {t(
              'These settings can only be edited by users with the organization owner or manager role.'
            )}
          </Alert>
        )}

        {children}
      </Stack>
    </Feature>
  );
}
