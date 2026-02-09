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

interface OnboardingCopyAsDropdownProps {
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
export function OnboardingCopyAsDropdown({
  steps,
  organization,
  source,
}: OnboardingCopyAsDropdownProps) {
  const {selectedTab} = useSelectedCodeTab();
  const authToken = useAuthToken();

  return (
    <Flex justify="end" marginBottom="xs">
      <Tooltip title={t('Let an LLM do all the work instead')}>
        <Button
          size="xs"
          icon={<IconCopy />}
          onClick={() => {
            trackAnalytics('onboarding.copy_instructions', {
              organization,
              format: 'markdown',
              source,
            });
            const markdown = stepsToMarkdown(steps, {
              selectedTabLabel: selectedTab ?? undefined,
              authToken,
            });
            copyToClipboard(markdown);
          }}
        >
          {t('Copy as Markdown')}
        </Button>
      </Tooltip>
    </Flex>
  );
}
