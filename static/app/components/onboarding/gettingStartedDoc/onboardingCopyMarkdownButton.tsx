import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useAuthToken} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useTabSelectionsMap} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {stepsToMarkdown} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

interface CopyMarkdownButtonProps {
  getMarkdown: () => string;
  source: string;
  borderless?: boolean;
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
  source,
  borderless,
}: CopyMarkdownButtonProps) {
  return (
    <Tooltip
      title={t(
        'Copies all steps and code examples as Markdown, optimized for use with an LLM.'
      )}
      position="auto"
    >
      <Button
        priority={borderless ? 'transparent' : undefined}
        icon={<IconCopy />}
        analyticsEventKey="setup_guide.copy_as_markdown"
        analyticsEventName="Setup Guide: Copy as Markdown"
        analyticsParams={{format: 'markdown', source}}
        onClick={() => copyToClipboard(getMarkdown())}
        size="xs"
      >
        {t('Copy instructions')}
      </Button>
    </Tooltip>
  );
}

interface OnboardingCopyMarkdownButtonProps {
  source: string;
  steps: OnboardingStep[];
  borderless?: boolean;
}

/**
 * A "Copy to Markdown" button pre-wired for onboarding steps. Reads
 * registered tab selections and the auth token at click time.
 */
export function OnboardingCopyMarkdownButton({
  steps,
  source,
  borderless,
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
      source={source}
      borderless={borderless}
    />
  );
}

const FEATURE_FLAG = 'onboarding-copy-setup-instructions';

/**
 * Feature-gated wrapper that renders its children only when the
 * `onboarding-copy-setup-instructions` flag is enabled. Includes spacing
 * so callsites don't render an empty Container when the flag is off.
 */
export function useCopySetupInstructionsEnabled(): boolean {
  const organization = useOrganization();
  return organization.features.includes(FEATURE_FLAG);
}

export function CopySetupInstructionsGate({children}: {children: React.ReactNode}) {
  const enabled = useCopySetupInstructionsEnabled();
  if (!enabled) {
    return null;
  }
  return children;
}
