import testAnalyticsGHAWorkflowExample from 'sentry-images/features/test-analytics-gha-workflow-ex.png';

import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

export function GHAWorkflowExpandable() {
  return (
    <OnboardingStep.ExpandableDropdown
      triggerContent={
        <div>
          {tct(
            'A GitHub Actions workflow for a repository using [pytest] might look something like this:',
            {
              pytest: <Text variant="promotion">{t('pytest')}</Text>,
            }
          )}
        </div>
      }
    >
      <img src={testAnalyticsGHAWorkflowExample} />
    </OnboardingStep.ExpandableDropdown>
  );
}
