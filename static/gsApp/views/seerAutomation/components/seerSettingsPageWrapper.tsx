import {Fragment, useEffect} from 'react';

import {Alert} from '@sentry/scraps/alert/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {ExternalLink} from '@sentry/scraps/link';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import type {BillingSeatAssignment} from 'getsentry/types';
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

  const hasFeatureFlag = organization.features.includes('seat-based-seer-enabled');

  // Query billed seats only when feature flag is false.
  // This allows users who have downgraded mid-period but still have seats assigned
  // to continue managing their Seer settings.
  const {data: billedSeats, isPending: isLoadingBilledSeats} = useApiQuery<
    BillingSeatAssignment[]
  >([`/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`], {
    staleTime: 0,
    enabled: !hasFeatureFlag,
  });

  const hasBilledSeats = billedSeats && billedSeats.length > 0;
  const canAccessSettings = hasFeatureFlag || hasBilledSeats;

  useEffect(() => {
    // If the org is on the old-seer plan then they shouldn't be here on this new settings page
    // Or if we haven't launched the new seer yet.
    // Then they need to see old settings page, or get downgraded off old seer.
    if (!showNewSeer(organization)) {
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/`));
      return;
    }

    if (hasFeatureFlag) {
      return;
    }

    if (isLoadingBilledSeats) {
      return;
    }

    if (hasBilledSeats) {
      return;
    }

    navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/trial/`));
  }, [navigate, organization, hasFeatureFlag, isLoadingBilledSeats, hasBilledSeats]);

  if (!hasFeatureFlag && (isLoadingBilledSeats || !canAccessSettings)) {
    return <NoAccess />;
  }

  return (
    <Fragment>
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
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/ai-code-review/" />
            ),
          }
        )}
        action={
          <Flex gap="lg">
            <FeedbackButton
              size="md"
              feedbackOptions={{
                messagePlaceholder: t('How can we make Seer better for you?'),
                tags: {
                  ['feedback.source']: 'seer-settings-org',
                  ['feedback.owner']: 'coding-workflows',
                },
              }}
            />
            <LinkButton
              href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities"
              external
            >
              {t('Read the docs')}
            </LinkButton>
          </Flex>
        }
      />

      <Stack gap="lg">
        <SeerWizardSetupBanner />

        <SettingsPageTabs />

        {canWrite ? null : (
          <Alert data-test-id="org-permission-alert" variant="warning">
            {t(
              'These settings can only be edited by users with the organization owner or manager role.'
            )}
          </Alert>
        )}

        {children}
      </Stack>
    </Fragment>
  );
}
