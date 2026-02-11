import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useAuthToken} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useTabSelectionsMap} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {stepsToMarkdown} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

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
    <Tooltip
      title={t(
        'Copies all steps and code examples as Markdown, optimized for use with an LLM.'
      )}
      position="right"
    >
      <Button
        icon={<IconCopy />}
        onClick={() => {
          trackAnalytics('setup_guide.copy_as_markdown', {
            organization,
            format: 'markdown',
            source,
          });
          copyToClipboard(getMarkdown());
        }}
      >
        {t('Copy setup instructions')}
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
 * A "Copy to Markdown" button pre-wired for onboarding steps. Reads
 * registered tab selections and the auth token at click time.
 */
export function OnboardingCopyMarkdownButton({
  steps,
  organization,
  source,
}: OnboardingCopyMarkdownButtonProps) {
  const authToken = useAuthToken();
  const tabSelectionsMap = useTabSelectionsMap();

  const getMarkdown = () => {
    try {
      return stepsToMarkdown(steps, {
        tabSelectionsMap,
        authToken,
      });
    } catch {
      return '';
    }
  };

  return (
    <CopyMarkdownButton
      getMarkdown={getMarkdown}
      organization={organization}
      source={source}
    />
  );
}

const FEATURE_FLAG = 'onboarding-copy-setup-instructions';

/**
 * Feature-gated wrapper that renders its children only when the
 * `onboarding-copy-setup-instructions` flag is enabled. Includes spacing
 * so callsites don't render an empty Container when the flag is off.
 */
export function CopySetupInstructionsGate({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  if (!organization.features.includes(FEATURE_FLAG)) {
    return null;
  }
  return <Container paddingBottom="md">{children}</Container>;
}
