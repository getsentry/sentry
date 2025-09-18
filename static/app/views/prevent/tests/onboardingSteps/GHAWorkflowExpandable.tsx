import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

const GHA_WORKFLOW_SNIPPET = `
name: Workflow for Sentry Prevent Action
on: [push, pull_request]

jobs:
  unit-test:
    name: Run unit tests
    runs-on: ubuntu-latest
    # Copy and paste the permissions block here
    permissions:
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - name: Set up Python 3.11
        uses: actions/setup-python@v3
        with:
          python-version: 3.11
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Test with pytest
        run: |
          pytest --cov --junitxml=junit.xml
      # Copy and paste the getsentry/prevent-action here
      - name: Upload test results to Prevent
        if: \${{ !cancelled() }}
        uses: getsentry/prevent-action

      - name: Upload coverage to Prevent
        uses: getsentry/prevent-action
`;

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
      <CodeSnippet dark language="yaml">
        {GHA_WORKFLOW_SNIPPET}
      </CodeSnippet>
    </OnboardingStep.ExpandableDropdown>
  );
}
