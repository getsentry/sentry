import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useAuthToken} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useSelectedCodeTab} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {stepsToMarkdown} from 'sentry/components/onboarding/gettingStartedDoc/utils/stepsToMarkdown';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface CopyMarkdownButtonProps {
  getMarkdown: () => string;
  organization: Organization;
  source: string;
}

/**
 * A standalone "Copy as Markdown" button with tooltip and analytics tracking.
 * Accepts a `getMarkdown` callback to produce the clipboard content.
 *
 * Use this directly when you already have a markdown-producing function
 * (e.g. innerHTML-based conversion in crons guides). For onboarding-step
 * surfaces that need tab-selection and auth-token context, use
 * `OnboardingCopyMarkdownButton` instead.
 */
export function CopyMarkdownButton({
  getMarkdown,
  organization,
  source,
}: CopyMarkdownButtonProps) {
  return (
    <Tooltip title={t('Let an LLM do all the work instead')} position="right">
      <Button
        icon={<IconCopy />}
        onClick={() => {
          trackAnalytics('onboarding.copy_instructions', {
            organization,
            format: 'markdown',
            source,
          });
          copyToClipboard(getMarkdown());
        }}
      >
        {t('Copy as Markdown')}
      </Button>
    </Tooltip>
  );
}

interface OnboardingCopyMarkdownButtonProps {
  organization: Organization;
  source: string;
  steps: OnboardingStep[];
}

/**
 * A "Copy to Markdown" button pre-wired for onboarding steps. Reads from
 * SelectedCodeTabContext to copy only the user's currently selected tab variant.
 *
 * Must be rendered inside a `<SelectedCodeTabProvider>`.
 */
export function OnboardingCopyMarkdownButton({
  steps,
  organization,
  source,
}: OnboardingCopyMarkdownButtonProps) {
  const {selectedTab} = useSelectedCodeTab();
  const authToken = useAuthToken();

  const getMarkdown = () =>
    stepsToMarkdown(steps, {
      selectedTabLabel: selectedTab ?? undefined,
      authToken,
    });

  return (
    <Flex justify="start" paddingBottom="md">
      <CopyMarkdownButton
        getMarkdown={getMarkdown}
        organization={organization}
        source={source}
      />
    </Flex>
  );
}
