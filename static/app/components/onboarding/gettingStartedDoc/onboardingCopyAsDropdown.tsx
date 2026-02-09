import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {useAuthToken} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useSelectedCodeTab} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  stepsToMarkdown,
  stepsToText,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/stepsToMarkdown';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

interface OnboardingCopyAsDropdownProps {
  organization: Organization;
  source: string;
  steps: OnboardingStep[];
}

/**
 * CopyAsDropdown pre-wired for onboarding steps. Reads from SelectedCodeTabContext
 * to copy only the user's currently selected tab variant.
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
      <CopyAsDropdown
        size="xs"
        items={CopyAsDropdown.makeDefaultCopyAsOptions({
          markdown: () => {
            trackAnalytics('onboarding.copy_instructions', {
              organization,
              format: 'markdown',
              source,
            });
            return stepsToMarkdown(steps, {
              selectedTabLabel: selectedTab ?? undefined,
              authToken,
            });
          },
          text: () => {
            trackAnalytics('onboarding.copy_instructions', {
              organization,
              format: 'text',
              source,
            });
            return stepsToText(steps, {
              selectedTabLabel: selectedTab ?? undefined,
              authToken,
            });
          },
          json: undefined,
        })}
      />
    </Flex>
  );
}
