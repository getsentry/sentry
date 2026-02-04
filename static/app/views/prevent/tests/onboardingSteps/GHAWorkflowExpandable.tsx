import {CodeBlock} from '@sentry/scraps/code';

import {tct} from 'sentry/locale';
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
        uses: actions/checkout@v5
        with:
          fetch-depth: 2

      - name: Set up Python
        uses: actions/setup-python@v3

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Test with pytest
        run: pytest --cov --junitxml=junit.xml

      # Copy and paste the getsentry/prevent-action here
      - name: Upload test results to Sentry Prevent
        if: \${{ !cancelled() }}
        uses: getsentry/prevent-action@v0
`.trim();

export function GHAWorkflowExpandable() {
  return (
    <OnboardingStep.ExpandableDropdown
      triggerContent={
        <div>
          {tct(
            'A GitHub Actions workflow for a repository using [code:pytest] might look something like this:',
            {
              code: <code />,
            }
          )}
        </div>
      }
    >
      <CodeBlock dark language="yaml" linesToHighlight={[8, 9, 10, 29, 30, 31, 32]}>
        {GHA_WORKFLOW_SNIPPET}
      </CodeBlock>
    </OnboardingStep.ExpandableDropdown>
  );
}
